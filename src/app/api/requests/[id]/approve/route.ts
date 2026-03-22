import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { sendNotificationEmail } from '@/lib/mailer';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestId = params.id;
  const { action, comment } = await req.json(); // 'APPROVE' | 'REJECT'
  const email = session.user.email;

  if (action !== 'APPROVE' && action !== 'REJECT') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  try {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { approvalSteps: { orderBy: { stepOrder: 'asc' } } }
    });

    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (request.status !== 'PENDING') return NextResponse.json({ error: 'Request is already processed' }, { status: 400 });

    // 自分自身のPENDINGなステップを探す
    const myStep = request.approvalSteps.find((s: any) => s.status === 'PENDING' && s.approverEmail === email);
    
    if (!myStep) {
      return NextResponse.json({ error: 'You are not perfectly authorized to approve right now' }, { status: 403 });
    }

    // 自分のステップが含まれる order グループの全タスクが "承認可能な状態か (前のタスクが終わっているか)" の確認
    // 前のグループ (order < myStep.stepOrder) に PENDING や REJECTED があればエラーにする
    const previousUnfinished = request.approvalSteps.find((s: any) => s.stepOrder < myStep.stepOrder && s.status !== 'APPROVED');
    if (previousUnfinished) {
      return NextResponse.json({ error: 'Previous approval steps are not completed yet' }, { status: 400 });
    }

    let isRequestRejected = false;
    let isRequestApproved = false;
    let nextApprovers: string[] = [];

    await prisma.$transaction(async (tx: any) => {
      // 1. 自身のステップを更新
      await tx.approvalStep.update({
        where: { id: myStep.id },
        data: {
          status: action,
          comment: comment || null,
        }
      });

      if (action === 'REJECT') {
        isRequestRejected = true;
        await tx.request.update({
          where: { id: requestId },
          data: { status: 'REJECTED' }
        });
      } else if (action === 'APPROVE') {
        // 同一のstepOrderの全タスクを取得 (更新された状態であるはずがトランザクション内なので再取得または自分で判定)
        const updatedSteps = await tx.approvalStep.findMany({
          where: { requestId }
        });
        
        const sameOrderSteps = updatedSteps.filter((s: any) => s.stepOrder === myStep.stepOrder);
        const isAllSameOrderApproved = sameOrderSteps.every((s: any) => s.status === 'APPROVED');

        if (isAllSameOrderApproved) {
          // 次のorderを探す
          const nextOrder = myStep.stepOrder + 1;
          const nextSteps = updatedSteps.filter((s: any) => s.stepOrder === nextOrder);

          if (nextSteps.length > 0) {
            nextApprovers = nextSteps.map((s: any) => s.approverEmail);
          } else {
            isRequestApproved = true;
            await tx.request.update({
              where: { id: requestId },
              data: { status: 'APPROVED' }
            });
          }
        }
      }
    });

    // 2. メールの送信処理 (トランザクション完了後)
    // ホストヘッダーから基準URLを取得（環境変数に頼らない方法）
    const headersList = headers();
    const host = headersList.get('host');
    console.log('DEBUG: Approve route host header:', host);
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const url = `${baseUrl}/requests/${requestId}`;

    if (isRequestRejected) {
      await sendNotificationEmail(
        request.applicantEmail,
        `【買付/リフォーム承認：却下】${request.title}`,
        `申請が却下されました。\n却下者: ${email}\n理由: ${comment || 'なし'}\nURL: ${url}`,
        session.user.name || email || undefined,
        email || undefined
      );
    } else if (isRequestApproved) {
      await sendNotificationEmail(
        request.applicantEmail,
        `【買付/リフォーム承認：完了】${request.title}`,
        `申請がすべての承認者により承認されました。\nURL: ${url}`,
        session.user.name || email || undefined,
        email || undefined
      );
    } else if (nextApprovers.length > 0) {
      // 次の承認者へ並行してメール送信
      for (const approverEmail of nextApprovers) {
        await sendNotificationEmail(
          approverEmail,
          `【承認依頼】${request.title}`,
          `前のステップの承認が完了し、あなたの承認待ちとなりました。\n最終コメント: ${comment || 'なし'}\nURL: ${url}`,
          session.user.name || email || undefined,
          email || undefined
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
