import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 特定のドメインまたは特定のユーザーのみ許可（念のため）
  if (!session.user.email.endsWith('@tokyomf.co.jp')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  // 簡易的な秘密鍵チェック
  if (secret !== 'reset-2026') {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 400 });
  }

  try {
    // 申請履歴 (Request) をすべて削除
    // ApprovalStep は Request に紐づいて Cascade Delete 設定されているため同時に消えます
    const deleteResult = await prisma.request.deleteMany({});

    return NextResponse.json({
      message: 'Initial data reset successful!',
      deletedCount: deleteResult.count,
      status: 'Ready for production.'
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error during reset' }, { status: 500 });
  }
}
