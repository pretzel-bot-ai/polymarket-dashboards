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

async function fetchOnChainUsdc(wallet: string): Promise<number> {
  const USDC_NATIVE = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
  const USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  const padded = wallet.replace('0x', '').toLowerCase().padStart(64, '0');
  const data = '0x70a08231' + padded; // balanceOf(address)

  async function bal(contract: string): Promise<number> {
    const r = await fetch('https://polygon.drpc.org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: contract, data }, 'latest'], id: 1 }),
    });
    const j = await r.json();
    if (!j.result || j.result === '0x') return 0;
    return parseInt(j.result, 16) / 1e6; // USDC has 6 decimals
  }

  const [native, bridged] = await Promise.all([bal(USDC_NATIVE), bal(USDC_E)]);
  return native + bridged;
}

async function fetchActivity(): Promise<any[]> {
  const results: any[] = [];
  let offset = 0;
  const limit = 200;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(
      `https://data-api.polymarket.com/activity?user=${WALLET}&limit=${limit}&offset=${offset}`,
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

    const [positions, trades, rewardsRaw, valueData, activity, onChainUsdc] = await Promise.all([
      fetch(
        `https://data-api.polymarket.com/positions?user=${WALLET}&sizeThreshold=0&limit=500`,
        { next: { revalidate: 60 } }
      ).then(r => r.json()),
      fetchAllTrades(),
      fetch(`https://polymarket.com/api/rewards/markets?maker=${WALLET}`, {
        next: { revalidate: 300 },
      }).then(r => r.json()).then(d => d?.data || []).catch(() => []),
      fetch(`https://data-api.polymarket.com/value?user=${WALLET}`, {
        next: { revalidate: 60 },
      }).then(r => r.json()).then(d => Array.isArray(d) ? d[0] : d).catch(() => null),
      fetchActivity(),
      fetchOnChainUsdc(WALLET).catch(() => 0),
    ]);

    // Categorize positions
    const categorized = (Array.isArray(positions) ? positions : []).map((p: any) => ({
      ...p,
      category: autoCategorize(p.title),
    }));

    // Portfolio summary
    const positionsValue = categorized.reduce((s: number, p: any) => s + (p.currentValue || 0), 0);
    const totalValue = positionsValue + onChainUsdc;
    const cashBalance = onChainUsdc;

    // unrealized = mark-to-market on open positions (cashPnl where currentValue > 0)
    // realized   = sum of realizedPnl from the positions API (completed trade gains)
    // total      = sum(cashPnl + realizedPnl) for ALL positions — this captures settled
    //              losses implicitly via cashPnl going to -initialValue on resolution
    const totalUnrealized = categorized
      .filter((p: any) => (p.currentValue || 0) > 0)
      .reduce((s: number, p: any) => s + (p.cashPnl || 0), 0);
    const totalRealized = categorized
      .reduce((s: number, p: any) => s + (p.realizedPnl || 0), 0);
    const totalPnl = categorized
      .reduce((s: number, p: any) => s + (p.cashPnl || 0) + (p.realizedPnl || 0), 0);

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

    // Time-based realized flow: REDEEM proceeds + SELL proceeds - BUY costs.
    // REDEEM = settled winning positions cashed out.
    // This is actual USDC received/spent, not unrealized P&L on open positions.
    function realizedFlow(cutoff: number) {
      return activity
        .filter((a: any) => a.timestamp >= cutoff)
        .reduce((sum: number, a: any) => {
          const usdc = a.usdcSize || 0;
          if (a.type === 'REDEEM' || a.type === 'REWARD' || a.type === 'YIELD') return sum + usdc;
          if (a.type === 'TRADE') return sum + (a.side === 'SELL' ? usdc : -usdc);
          return sum;
        }, 0);
    }

    // Top contributing markets per period (by net USDC flow)
    function topMarkets(cutoff: number, n = 5) {
      const map: Record<string, number> = {};
      for (const a of activity.filter((a: any) => a.timestamp >= cutoff)) {
        const usdc = a.usdcSize || 0;
        const title = a.title || (a.type === 'REWARD' ? 'LP Reward' : a.type === 'YIELD' ? 'USDC Yield' : '?');
        let flow = 0;
        if (a.type === 'REDEEM' || a.type === 'REWARD' || a.type === 'YIELD') flow = usdc;
        else if (a.type === 'TRADE') flow = a.side === 'SELL' ? usdc : -usdc;
        if (flow !== 0) map[title] = (map[title] || 0) + flow;
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
        category: autoCategorize(m.question),
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
        category: autoCategorize(m.question),
      }));

    return NextResponse.json({
      wallet: WALLET,
      updatedAt: new Date().toISOString(),
      portfolio: {
        totalValue,
        positionsValue,
        cashBalance,
        onChainUsdc,
        unrealizedPnl: totalUnrealized,
        realizedPnl: totalRealized,
        totalPnl,
        openCount,
        totalPositions: categorized.length,
      },
      pnl: {
        day: realizedFlow(cutoff1d),
        week: realizedFlow(cutoff7d),
        month: realizedFlow(cutoff30d),
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
      activity: activity.map((a: any) => ({
        timestamp: a.timestamp,
        type: a.type,
        side: a.side || null,
        title: a.title || null,
        outcome: a.outcome || null,
        size: a.size || 0,
        usdcSize: a.usdcSize || 0,
        price: a.price || 0,
        slug: a.slug || null,
        eventSlug: a.eventSlug || null,
        transactionHash: a.transactionHash || null,
      })),
    });
  } catch (e) {
    console.error('Dashboard API error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
