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

    // === Cost-basis reconstruction from activity BUY/SELL history ===
    // We use the activity API (not the trades API — which returns only the last ~30 records)
    // because activity contains the full BUY/SELL history across all positions.
    //
    // Phase 1: replay BUY/SELL events chronologically → running avgCost per conditionId.
    //   At each SELL: profit = shares × (sell_price − avgCost_at_that_moment)
    // Phase 2: snapshot finalAvgCost (cost/share of still-held shares going into settlement)
    // Phase 3: apply REDEEMs to drain costBasis → remaining_cost reflects only open positions

    interface CostState { size: number; totalCost: number; }
    const costBasis: Record<string, CostState> = {};

    // sellProfits: one entry per SELL event with its realised profit and timestamp
    const sellProfits: Array<{ timestamp: number; profit: number; title: string }> = [];

    // activity is returned newest-first; sort ascending for correct replay
    const sortedActivity = [...activity].sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));

    for (const a of sortedActivity) {
      if (a.type !== 'TRADE') continue;
      const cid = a.conditionId;
      if (!cid) continue;
      if (!costBasis[cid]) costBasis[cid] = { size: 0, totalCost: 0 };
      const state = costBasis[cid];
      const size  = Math.abs(a.size  || 0);
      const price = a.price || 0;

      if (a.side === 'BUY') {
        state.totalCost += size * price;
        state.size      += size;
      } else if (a.side === 'SELL') {
        const avgCost = state.size > 0 ? state.totalCost / state.size : 0;
        sellProfits.push({
          timestamp: a.timestamp || 0,
          profit:    size * (price - avgCost),
          title:     a.title || '?',
        });
        state.totalCost = Math.max(0, state.totalCost - size * avgCost);
        state.size      = Math.max(0, state.size      - size);
      }
    }

    // Phase 2: snapshot avg cost per share after all sells (used for REDEEM P&L)
    const finalAvgCost: Record<string, number> = {};
    for (const [cid, state] of Object.entries(costBasis)) {
      finalAvgCost[cid] = state.size > 0 ? state.totalCost / state.size : 0;
    }

    // Phase 3: drain costBasis via REDEEMs so remaining_cost only reflects truly open positions
    for (const a of sortedActivity) {
      if (a.type !== 'REDEEM') continue;
      const cid = a.conditionId;
      if (!cid) continue;
      const size = Math.abs(a.size || 0);
      const avg  = finalAvgCost[cid] ?? 0;
      const state = costBasis[cid];
      if (!state) continue;
      state.totalCost = Math.max(0, state.totalCost - size * avg);
      state.size      = Math.max(0, state.size      - size);
    }

    // All-time totals derived from full activity reconstruction.
    // These are more accurate than the positions API, which only returns current positions
    // and loses realizedPnl from fully-closed historical positions.
    const remainingCost = Object.values(costBasis).reduce((s, st) => s + st.totalCost, 0);
    const allTimeUnrealized = positionsValue - remainingCost; // open mark-to-market vs cost

    // Period P&L broken down by component
    function flowBreakdown(cutoff: number): { sells: number; redeems: number; misc: number } {
      const sells = sellProfits
        .filter(s => s.timestamp >= cutoff)
        .reduce((sum, s) => sum + s.profit, 0);
      let redeems = 0, misc = 0;
      for (const a of sortedActivity) {
        if ((a.timestamp || 0) < cutoff) continue;
        if (a.type === 'REDEEM') {
          const avgCost = finalAvgCost[a.conditionId] ?? 0;
          redeems += (a.usdcSize || 0) - (a.size || 0) * avgCost;
        } else if (a.type === 'YIELD' || a.type === 'REWARD') {
          misc += a.usdcSize || 0;
        }
      }
      return { sells, redeems, misc };
    }

    function realizedFlow(cutoff: number): number {
      const { sells, redeems, misc } = flowBreakdown(cutoff);
      return sells + redeems + misc;
    }

    // Top contributing markets per period
    function topMarkets(cutoff: number, n = 5) {
      const map: Record<string, number> = {};

      for (const s of sellProfits.filter(s => s.timestamp >= cutoff)) {
        if (s.profit === 0) continue;
        map[s.title] = (map[s.title] || 0) + s.profit;
      }

      for (const a of sortedActivity.filter((a: any) => a.timestamp >= cutoff)) {
        let profit = 0;
        let title = a.title || '?';
        if (a.type === 'REDEEM') {
          const avgCost = finalAvgCost[a.conditionId] ?? 0;
          profit = (a.usdcSize || 0) - (a.size || 0) * avgCost;
        } else if (a.type === 'YIELD') {
          profit = a.usdcSize || 0;
          title = 'USDC Yield';
        } else if (a.type === 'REWARD') {
          profit = a.usdcSize || 0;
          title = 'LP Reward';
        }
        if (profit === 0) continue;
        map[title] = (map[title] || 0) + profit;
      }

      return Object.entries(map)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, n)
        .map(([title, pnl]) => ({ title, pnl }));
    }

    const allTimeRealized = realizedFlow(0);
    const allTimeNet      = allTimeRealized + allTimeUnrealized;

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
        unrealizedPnl: allTimeUnrealized,
        realizedPnl: allTimeRealized,
        totalPnl: allTimeNet,
        openCount,
        totalPositions: categorized.length,
      },
      pnl: {
        day:   { ...flowBreakdown(cutoff1d),  total: realizedFlow(cutoff1d)  },
        week:  { ...flowBreakdown(cutoff7d),  total: realizedFlow(cutoff7d)  },
        month: { ...flowBreakdown(cutoff30d), total: realizedFlow(cutoff30d) },
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
