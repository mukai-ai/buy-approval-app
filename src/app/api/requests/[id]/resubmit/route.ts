import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { sendNotificationEmail } from '@/lib/mailer';
import { CONFIRMATION_TYPES, getTypeLabel, getDateLabel } from "@/lib/requestTypes";

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestId = params.id;

  try {
    const existing = await prisma.request.findUnique({
      where: { id: requestId },
      include: { approvalSteps: { orderBy: { stepOrder: 'asc' } } }
    });

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.applicantEmail !== session.user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (existing.status !== 'REJECTED') {
      return NextResponse.json({ error: 'Only rejected requests can be resubmitted' }, { status: 400 });
    }

    const body = await req.json();
    const { title, startDate, attachmentFile, amount, companyName, applicantComment } = body;

    const nextRound = existing.resubmitCount + 2; // 現在のラウンド+1（再申請=2回目以降）

    // 既存の承認フローからステップ構成を復元（重複なし）
    const uniqueSteps: { email: string; order: number }[] = [];
    const seen = new Set<string>();
    for (const step of existing.approvalSteps) {
      const key = `${step.approverEmail}-${step.stepOrder}`;
      if (!seen.has(key)) {
        uniqueSteps.push({ email: step.approverEmail, order: step.stepOrder });
        seen.add(key);
      }
    }

    await prisma.$transaction(async (tx: any) => {
      // 1. リクエストを更新
      await tx.request.update({
        where: { id: requestId },
        data: {
          title: title || existing.title,
          startDate: startDate ? new Date(startDate) : existing.startDate,
          attachmentFile: attachmentFile !== undefined ? attachmentFile : existing.attachmentFile,
          amount: amount !== undefined ? parseFloat(amount) : existing.amount,
          companyName: companyName !== undefined ? companyName : existing.companyName,
          status: 'PENDING',
          resubmitCount: existing.resubmitCount + 1,
          applicantComment: existing.type === 'BUY' ? applicantComment : existing.applicantComment,
        }
      });

      // 2. 新しいラウンドの承認ステップを作成
      for (const step of uniqueSteps) {
        await tx.approvalStep.create({
          data: {
            requestId,
            approverEmail: step.email,
            stepOrder: step.order,
            round: nextRound,
          }
        });
      }
    });

    // 第1承認者へメール通知
    const host = headers().get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const url = `${baseUrl}/requests/${requestId}`;

    const updatedRequest = await prisma.request.findUnique({ where: { id: requestId } });
    let specificInfoLine = '';
    if (CONFIRMATION_TYPES.includes(existing.type)) {
      const d = updatedRequest?.startDate;
      const formattedDate = d ? new Date(d).toLocaleDateString('ja-JP') : '未入力';
      specificInfoLine = `${getDateLabel(existing.type)}: ${formattedDate}\n`;
    } else {
      const amt = updatedRequest?.amount ?? existing.amount;
      specificInfoLine = `金額: ${amt.toLocaleString()}円\n`;
    }

    if (existing.type === 'BUY' && updatedRequest?.applicantComment) {
      specificInfoLine += `申請者コメント: ${updatedRequest.applicantComment}\n`;
    }

    const firstApprovers = [...new Set(uniqueSteps.filter(s => s.order === 1).map(s => s.email))];
    for (const approverEmail of firstApprovers) {
      await sendNotificationEmail(
        approverEmail,
        `【承認依頼（再申請）】${updatedRequest?.title || existing.title}`,
        `申請が再申請されました。\n申請区分: ${getTypeLabel(existing.type)}\n申請者: ${session.user.email}\n${specificInfoLine}URL: ${url}`,
        session.user.name || session.user.email || undefined,
        session.user.email || undefined
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Resubmit error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
