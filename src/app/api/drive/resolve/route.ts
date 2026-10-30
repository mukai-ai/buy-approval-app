import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { resolveDrivePath } from '@/lib/googleDrive';

export const dynamic = 'force-dynamic';

// 社内サーバーのパス(G:\共有ドライブ\...)を、閲覧者の権限で開けるGoogle DriveのURLに変換する
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = new URL(request.url).searchParams.get('path') || '';
  if (!path || path.length > 500) {
    return NextResponse.json({ status: 'not_found' });
  }

  const result = await resolveDrivePath(session.user.email, path);
  return NextResponse.json(result);
}
