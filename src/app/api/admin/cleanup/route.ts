import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const titlesToDelete = [
    "テスト１００",
    "テスト100",
    "テスト 100",
    "テスト １００",
    "テスト　１００"
  ];

  try {
    const result = await prisma.request.deleteMany({
      where: {
        title: {
          in: titlesToDelete
        }
      }
    });

    return NextResponse.json({ message: 'Deleted successfully', count: result.count });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
