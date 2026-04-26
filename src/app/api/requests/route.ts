import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { sendNotificationEmail } from '@/lib/mailer';
import { CONFIRMATION_TYPES, getTypeLabel, getDateLabel } from "@/lib/requestTypes";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const email = session.user.email;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '5');
  const all = searchParams.get('all') === 'true';
  const search = searchParams.get('search') || '';
  
  const myPage = parseInt(searchParams.get('myPage') || '1');
  const myLimit = parseInt(searchParams.get('myLimit') || '5');
  const mySearch = searchParams.get('mySearch') || '';
  
  const skip = (page - 1) * limit;
  const mySkip = (myPage - 1) * myLimit;

  // 検索条件の構築 (過去の承認履歴用)
  const pastWhere: any = {
    approverEmail: email,
    status: { in: ['APPROVED', 'REJECTED'] },
  };

  if (search) {
    pastWhere.request = {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { applicantEmail: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  // 検索条件の構築 (自分の申請状況用)
  const myWhere: any = {
    applicantEmail: email,
  };

  if (mySearch) {
    myWhere.title = { contains: mySearch, mode: 'insensitive' };
  }

  // 自分の申請状況 (myRequests)
  const myRequests = await prisma.request.findMany({
    where: myWhere,
    include: { approvalSteps: true },
    orderBy: { createdAt: 'desc' },
    skip: all ? undefined : mySkip,
    take: all ? undefined : myLimit,
  });
  const myRequestsTotal = await prisma.request.count({ where: myWhere });

  // 承認依頼 (pendingApprovals)
  const pendingApprovals = await prisma.approvalStep.findMany({
    where: { approverEmail: email, status: 'PENDING' },
    include: { request: true },
    orderBy: { createdAt: 'desc' },
    skip: all ? undefined : skip,
    take: all ? undefined : limit,
  });
  const pendingApprovalsTotal = await prisma.approvalStep.count({ where: { approverEmail: email, status: 'PENDING' } });

  // 過去の承認履歴 (pastApprovals)
  let pastApprovals: any[] = [];
  let pastApprovalsTotal = 0;

  if (all) {
    // CSV出力用: 重複排除せず全件取得
    pastApprovals = await prisma.approvalStep.findMany({
      where: pastWhere,
      include: { request: true },
      orderBy: { updatedAt: 'desc' },
    });
    pastApprovalsTotal = pastApprovals.length;
  } else {
    // UI表示用: 1申請につき最新の1件のみに絞り込む
    // まず対象ユーザーの該当するアクションを全件取得（IDと申請ID、更新日時のみ）
    const allMatchingSteps = await prisma.approvalStep.findMany({
      where: pastWhere,
      select: { id: true, requestId: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });

    // メモリ上で申請IDごとに最新のステップIDを抽出
    const uniqueRequestMap = new Map<string, string>();
    for (const s of allMatchingSteps) {
      if (!uniqueRequestMap.has(s.requestId)) {
        uniqueRequestMap.set(s.requestId, s.id);
      }
    }
    const latestStepIds = Array.from(uniqueRequestMap.values());
    pastApprovalsTotal = latestStepIds.length;

    // 現在のページに必要なIDのみ抽出
    const pageStepIds = latestStepIds.slice(skip, skip + limit);

    // 詳細情報を取得
    pastApprovals = await prisma.approvalStep.findMany({
      where: { id: { in: pageStepIds } },
      include: { request: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  return NextResponse.json({ 
    myRequests, 
    myRequestsTotal,
    pendingApprovals, 
    pendingApprovalsTotal,
    pastApprovals,
    pastApprovalsTotal
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const type = formData.get('type') as string;
    const title = formData.get('title') as string;
    const amountStr = formData.get('amount') as string;
    const amount = amountStr ? parseFloat(amountStr) : 0;
    
    const companyName = formData.get('companyName') as string | null;
    const startDate = formData.get('startDate') as string | null;
    const endDate = formData.get('endDate') as string | null;
    const attachmentLink = formData.get('attachmentLink') as string | null;
    const attachmentFile = formData.get('attachmentFile') as string | null;

    if (!title || !type) {
      return NextResponse.json({ error: 'Require title and type' }, { status: 400 });
    }

    // 承認フロー要件の決定
    let flow: { email: string; order: number }[] = [];

    if (type === 'BUY') {
      if (amount < 30000000) {
        flow.push({ email: 'koyanagi@tokyomf.co.jp', order: 1 });
      } else {
        flow.push({ email: 'koyanagi@tokyomf.co.jp', order: 1 });
        flow.push({ email: 'yoshitomi@tokyomf.co.jp', order: 2 });
        flow.push({ email: 'otsuka@tokyomf.co.jp', order: 2 });
      }
    } else if (type === 'REFORM') {
      if (amount < 15000000) {
        flow.push({ email: 'yoshitomi@tokyomf.co.jp', order: 1 });
      } else {
        flow.push({ email: 'yoshitomi@tokyomf.co.jp', order: 1 });
        flow.push({ email: 'koyanagi@tokyomf.co.jp', order: 2 });
        flow.push({ email: 'otsuka@tokyomf.co.jp', order: 2 });
      }
    } else if (CONFIRMATION_TYPES.includes(type)) {
      flow.push({ email: 'koyanagi@tokyomf.co.jp', order: 1 });
      flow.push({ email: 'satou@tokyomf.co.jp', order: 2 });
      flow.push({ email: 'yoshitomi@tokyomf.co.jp', order: 3 });
      flow.push({ email: 'otsuka@tokyomf.co.jp', order: 4 });
    }

    const newRequest = await prisma.$transaction(async (tx: any) => {
      const createdRequest = await tx.request.create({
        data: {
          type,
          title,
          amount,
          companyName,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          attachmentLink,
          attachmentFile: attachmentFile, // 直接テキストとして保存
          applicantEmail: session.user!.email!,
        },
      });

      for (const step of flow) {
        await tx.approvalStep.create({
          data: {
            requestId: createdRequest.id,
            approverEmail: step.email,
            stepOrder: step.order,
            round: 1,
          },
        });
      }

      return createdRequest;
    });

    // 最初のステップ (order === 1) の全員へ通知
    const firstApprovers = flow.filter(s => s.order === 1);
    const host = headers().get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const url = `${baseUrl}/requests/${newRequest.id}`;
    
    let specificInfoLine = '';
    if (CONFIRMATION_TYPES.includes(type)) {
      const formattedDate = startDate ? new Date(startDate).toLocaleDateString("ja-JP", { timeZone: 'Asia/Tokyo' }) : "未入力";
      specificInfoLine = `${getDateLabel(type)}: ${formattedDate}\n`;
    } else {
      specificInfoLine = `金額: ${amount.toLocaleString()}円\n`;
    }
    
    for (const approver of firstApprovers) {
      await sendNotificationEmail(
        approver.email,
        `【承認依頼】${title}`,
        `新しい申請が行われました。\n申請区分: ${getTypeLabel(type)}\n申請者: ${session.user.email}\n${specificInfoLine}URL: ${url}`,
        session.user.name || session.user.email || undefined,
        session.user.email || undefined
      );
    }

    if (CONFIRMATION_TYPES.includes(type)) {
      const ccList = [
        'info@tokyomf.co.jp',
        'keiri@tokyomf.co.jp',
        'ishii@tokyomf.co.jp'
      ];
      for (const ccEmail of ccList) {
        await sendNotificationEmail(
          ccEmail,
          `【周知】${getTypeLabel(type)}が申請されました：${title}`,
          `新しい${getTypeLabel(type)}が申請されました。\n※このメールは周知用です。システムでの承認操作は不要です。\n\n申請者: ${session.user.email}\n${specificInfoLine}URL: ${url}`,
          session.user.name || session.user.email || undefined,
          session.user.email || undefined
        );
      }
    }

    return NextResponse.json(newRequest);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
