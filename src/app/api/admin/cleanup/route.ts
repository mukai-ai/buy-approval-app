import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const titlesToDelete = [
    "テスト１００",
    "テスト　テストのため無視してください",
    "テスト③　テストのため無視してください",
    "テスト②　テストのため無視してください。",
    "テスト①　テストのため無視してください。"
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
