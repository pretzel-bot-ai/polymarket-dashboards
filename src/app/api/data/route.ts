import { NextResponse } from 'next/server';
import { fetchPolyData, autoCategorize } from '@/lib/poly';

const WALLET = '0xe005901e5c811e58d2d6e7338e109bd4ec1414fd';

export async function GET() {
  const [positions, value, trades] = await Promise.all([
    fetchPolyData('positions', WALLET),
    fetchPolyData('value', WALLET),
    fetchPolyData('trades', WALLET)
  ]);

  const categorizedPositions = positions?.map((p: any) => ({
    ...p,
    category: autoCategorize(p.title)
  })) || [];

  return NextResponse.json({
    positions: categorizedPositions,
    value: value?.[0]?.value || 0,
    trades: trades || [],
    wallet: WALLET
  });
}
