import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { sendNotificationEmail } from '@/lib/mailer';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const email = session.user.email;

  const myRequests = await prisma.request.findMany({
    where: { applicantEmail: email },
    include: { approvalSteps: true },
    orderBy: { createdAt: 'desc' },
  });

  const pendingApprovals = await prisma.approvalStep.findMany({
    where: { approverEmail: email, status: 'PENDING' },
    include: { request: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ myRequests, pendingApprovals });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const type = formData.get('type') as string;
    const title = formData.get('title') as string;
    const amountStr = formData.get('amount') as string;
    const amount = amountStr ? parseFloat(amountStr) : 0;
    
    const companyName = formData.get('companyName') as string | null;
    const startDate = formData.get('startDate') as string | null;
    const endDate = formData.get('endDate') as string | null;
    const attachmentLink = formData.get('attachmentLink') as string | null;
    const file = formData.get('file') as File | null;

    if (!title || !type) {
      return NextResponse.json({ error: 'Require title and type' }, { status: 400 });
    }

    // ファイルアップロード処理 (ローカル public/uploads へ保存)
    let attachmentFilePath = null;
    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filename = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }
      await writeFile(path.join(uploadDir, filename), buffer);
      attachmentFilePath = `/uploads/${filename}`;
    }

    // 承認フロー要件の決定
    let flow: { email: string; order: number }[] = [];

    if (type === 'BUY') {
      if (amount <= 30000000) {
        flow.push({ email: 'koyanagi@tokyomf.co.jp', order: 1 });
      } else {
        // 並列承認 (1: 小柳, 1: 吉富), 順次(2: 大塚)
        flow.push({ email: 'koyanagi@tokyomf.co.jp', order: 1 });
        flow.push({ email: 'yoshitomi@tokyomf.co.jp', order: 1 });
        flow.push({ email: 'otsuka@tokyomf.co.jp', order: 2 });
      }
    } else if (type === 'REFORM') {
      if (amount <= 15000000) {
        flow.push({ email: 'yoshitomi@tokyomf.co.jp', order: 1 });
      } else {
        flow.push({ email: 'yoshitomi@tokyomf.co.jp', order: 1 });
        flow.push({ email: 'otsuka@tokyomf.co.jp', order: 2 });
      }
    }

    const newRequest = await prisma.$transaction(async (tx: any) => {
      const request = await tx.request.create({
        data: {
          type,
          title,
          amount,
          companyName,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          attachmentLink,
          attachmentFile: attachmentFilePath,
          applicantEmail: session.user!.email!,
        },
      });

      for (const step of flow) {
        await tx.approvalStep.create({
          data: {
            requestId: request.id,
            approverEmail: step.email,
            stepOrder: step.order,
          },
        });
      }

      return request;
    });

    // 最初のステップ (order === 1) の全員へ通知
    const firstApprovers = flow.filter(s => s.order === 1);
    // ホストヘッダーから基準URLを取得（環境変数に頼らない方法）
    const host = req.headers.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const url = `${baseUrl}/requests/${newRequest.id}`;
    
    for (const approver of firstApprovers) {
      await sendNotificationEmail(
        approver.email,
        `【承認依頼】${title}`,
        `新しい申請が行われました。\n申請区分: ${type === 'BUY' ? '買付' : 'リフォーム'}\n申請者: ${session.user.email}\n金額: ${amount.toLocaleString()}円\nURL: ${url}`,
        session.user.name || session.user.email || undefined,
        session.user.email || undefined
      );
    }

    return NextResponse.json(newRequest);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
