import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { sendNotificationEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestId = params.id;
  const { report } = await req.json();

  if (!report || !report.trim()) {
    return NextResponse.json({ error: 'Report content is required' }, { status: 400 });
  }

  try {
    const existing = await prisma.request.findUnique({
      where: { id: requestId }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (existing.applicantEmail !== session.user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (existing.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Only approved requests can submit reports' }, { status: 400 });
    }

    // データベース更新
    const updated = await prisma.request.update({
      where: { id: requestId },
      data: {
        report,
        status: 'REPORTED'
      }
    });

    // 総務宛てにメール通知
    await sendNotificationEmail(
      'info@tokyomf.co.jp',
      `【利用報告】施設利用の事後報告が提出されました：${existing.title}`,
      `${session.user.email}さんから「${existing.facilityName}」の利用事後報告が提出されました。\n\n報告内容:\n${report}\n\n対象申請URL: ${req.url.split('/api')[0]}/requests/${requestId}`,
      session.user.name || session.user.email || undefined,
      session.user.email || undefined
    );

    return NextResponse.json({ success: true, request: updated });
  } catch (error) {
    console.error('Report submission error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
