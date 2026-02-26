import { NextResponse } from 'next/server';

const WALLET = '0xe005901e5c811e58d2d6e7338e109bd4ec1414fd';

function autoCategorize(title: string): string {
  const t = title.toLowerCase();
  if (
    t.includes('openai') || t.includes('claude') || t.includes('deepseek') ||
    t.includes('gpt') || t.includes('anthropic') || t.includes('llm') ||
    (t.includes('ai') && (t.includes('model') || t.includes('best') || t.includes('tool')))
  ) return 'AI & Tech';
  if (
    t.includes('google') || t.includes('microsoft') || t.includes('apple') ||
    t.includes('amazon') || t.includes('meta') || t.includes('nvidia') ||
    t.includes('tesla') || t.includes('spacex')
  ) return 'Tech';
  if (
    t.includes('bitcoin') || t.includes('btc') || t.includes(' eth ') ||
    t.includes('ethereum') || t.includes('crypto') || t.includes('solana') ||
    t.includes(' sol ') || t.includes('token') || t.includes('blockchain') ||
    t.includes('defi') || t.includes('nft') || t.includes('coinbase') ||
    t.includes('robinhood') || t.includes('insider trading')
  ) return 'Crypto & Finance';
  if (
    t.includes('election') || t.includes('president') || t.includes('nomination') ||
    t.includes('democratic') || t.includes('republican') || t.includes('congress') ||
    t.includes('senate') || t.includes('trump') || t.includes('biden') ||
    t.includes('harris') || t.includes('vote') || t.includes('party') ||
    t.includes('cuban') || t.includes('governor') || t.includes('mayor')
  ) return 'Politics';
  if (
    t.includes('nba') || t.includes('nfl') || t.includes('mlb') ||
    t.includes('soccer') || t.includes('football') || t.includes('championship') ||
    t.includes('super bowl') || t.includes('playoff') || t.includes('nhl') ||
    t.includes('tennis') || t.includes('golf') || t.includes('ufc') ||
    t.includes('boxing') || t.includes('olympic')
  ) return 'Sports';
  if (
    t.includes('fed ') || t.includes('federal reserve') || t.includes('rate cut') ||
    t.includes('recession') || t.includes('inflation') || t.includes('etf') ||
    t.includes('gdp') || t.includes('ipo') || t.includes('tariff')
  ) return 'Macro & Finance';
  return 'Other';
}

async function fetchAllTrades(): Promise<any[]> {
  const results: any[] = [];
  let offset = 0;
  const limit = 500;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(
      `https://data-api.polymarket.com/trades?user=${WALLET}&limit=${limit}&offset=${offset}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) break;
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) break;
    results.push(...items);
    if (items.length < limit) break;
    offset += limit;
  }
  return results;
}

export async function GET() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const cutoff1d = now - 86400;
    const cutoff7d = now - 7 * 86400;
    const cutoff30d = now - 30 * 86400;

    const [positions, trades, rewardsRaw] = await Promise.all([
      fetch(
        `https://data-api.polymarket.com/positions?user=${WALLET}&sizeThreshold=0&limit=500`,
        { next: { revalidate: 60 } }
      ).then(r => r.json()),
      fetchAllTrades(),
      fetch(`https://polymarket.com/api/rewards/markets?maker=${WALLET}`, {
        next: { revalidate: 300 },
      }).then(r => r.json()).then(d => d?.data || []).catch(() => []),
    ]);

    // Categorize positions
    const categorized = (Array.isArray(positions) ? positions : []).map((p: any) => ({
      ...p,
      category: autoCategorize(p.title),
    }));

    // Portfolio summary
    const totalValue = categorized.reduce((s: number, p: any) => s + (p.currentValue || 0), 0);
    const totalUnrealized = categorized.reduce((s: number, p: any) => s + (p.cashPnl || 0), 0);
    const totalRealized = categorized.reduce((s: number, p: any) => s + (p.realizedPnl || 0), 0);
    const openCount = categorized.filter((p: any) => p.currentValue > 0).length;

    // Category PnL
    const catMap: Record<string, { unrealized: number; realized: number }> = {};
    for (const p of categorized) {
      if (!catMap[p.category]) catMap[p.category] = { unrealized: 0, realized: 0 };
      catMap[p.category].unrealized += p.cashPnl || 0;
      catMap[p.category].realized += p.realizedPnl || 0;
    }
    const categoryPnl = Object.entries(catMap)
      .map(([cat, v]) => ({ category: cat, unrealized: v.unrealized, realized: v.realized, total: v.unrealized + v.realized }))
      .sort((a, b) => b.total - a.total);

    // Time-based PnL (net cash flow: sell proceeds - buy costs)
    function netFlow(cutoff: number) {
      return trades
        .filter((t: any) => t.timestamp >= cutoff)
        .reduce((sum: number, t: any) => {
          const val = (t.size || 0) * (t.price || 0);
          return sum + (t.side === 'SELL' ? val : -val);
        }, 0);
    }

    // Top contributing markets per period
    function topMarkets(cutoff: number, n = 5) {
      const map: Record<string, number> = {};
      for (const t of trades.filter((t: any) => t.timestamp >= cutoff)) {
        const val = (t.size || 0) * (t.price || 0);
        const flow = t.side === 'SELL' ? val : -val;
        map[t.title] = (map[t.title] || 0) + flow;
      }
      return Object.entries(map)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, n)
        .map(([title, pnl]) => ({ title, pnl }));
    }

    // Rewards: user's active LP markets
    const activeRewards = (rewardsRaw as any[])
      .filter((m: any) => m.earning_percentage > 0)
      .map((m: any) => ({
        question: m.question,
        event_slug: m.event_slug,
        ratePerDay: m.rewards_config?.[0]?.rate_per_day || 0,
        earningPct: m.earning_percentage,
        competitiveness: m.market_competitiveness,
      }));

    // Top rewards markets by rate (for reference even if not LP'd)
    const topRewards = (rewardsRaw as any[])
      .sort((a: any, b: any) => (b.rewards_config?.[0]?.rate_per_day || 0) - (a.rewards_config?.[0]?.rate_per_day || 0))
      .slice(0, 8)
      .map((m: any) => ({
        question: m.question,
        event_slug: m.event_slug,
        ratePerDay: m.rewards_config?.[0]?.rate_per_day || 0,
        earningPct: m.earning_percentage,
        competitiveness: m.market_competitiveness,
      }));

    return NextResponse.json({
      wallet: WALLET,
      updatedAt: new Date().toISOString(),
      portfolio: {
        totalValue,
        unrealizedPnl: totalUnrealized,
        realizedPnl: totalRealized,
        totalPnl: totalUnrealized + totalRealized,
        openCount,
        totalPositions: categorized.length,
      },
      pnl: {
        day: netFlow(cutoff1d),
        week: netFlow(cutoff7d),
        month: netFlow(cutoff30d),
        dayMarkets: topMarkets(cutoff1d),
        weekMarkets: topMarkets(cutoff7d),
        monthMarkets: topMarkets(cutoff30d),
      },
      categoryPnl,
      positions: categorized.sort((a: any, b: any) => b.currentValue - a.currentValue),
      rewards: {
        active: activeRewards,
        top: topRewards,
      },
    });
  } catch (e) {
    console.error('Dashboard API error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
