import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { unlink } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestId = params.id;

  try {
    const reqData = await prisma.request.findUnique({
      where: { id: requestId },
    });

    if (!reqData) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 自分の申請しか削除できない
    if (reqData.applicantEmail !== session.user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 添付ファイルがあれば削除
    if (reqData.attachmentFile) {
      const filePath = path.join(process.cwd(), 'public', reqData.attachmentFile);
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    }

    // データベースから削除 (Cascading delete to ApprovalSteps)
    await prisma.request.delete({
      where: { id: requestId },
    });

    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
