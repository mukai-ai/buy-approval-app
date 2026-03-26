import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { sendNotificationEmail } from '@/lib/mailer';

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
  const pastApprovals = await prisma.approvalStep.findMany({
    where: pastWhere,
    include: { request: true },
    orderBy: { updatedAt: 'desc' },
    skip: all ? undefined : skip,
    take: all ? undefined : limit,
  });
  const pastApprovalsTotal = await prisma.approvalStep.count({ 
    where: pastWhere 
  });

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
