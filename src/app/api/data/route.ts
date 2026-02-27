import { NextResponse } from 'next/server';

const WALLET = '0xe005901e5c811e58d2d6e7338e109bd4ec1414fd';

function autoCategorize(title: string): string {
  const t = title.toLowerCase();

  // Middle East (check before Politics — more specific)
  if (
    t.includes('israel') || t.includes('gaza') || t.includes('hamas') ||
    t.includes('hezbollah') || t.includes('lebanon') || t.includes('houthi') ||
    t.includes('west bank') || t.includes('iran') || t.includes('saudi') ||
    t.includes('yemen') || t.includes('syria') || t.includes('iraq') ||
    t.includes('middle east') || t.includes('netanyahu') || t.includes('idf')
  ) return 'Middle East';

  // Politics
  if (
    t.includes('election') || t.includes('president') || t.includes('nomination') ||
    t.includes('democratic') || t.includes('republican') || t.includes('congress') ||
    t.includes('senate') || t.includes('trump') || t.includes('biden') ||
    t.includes('harris') || t.includes('vance') || t.includes('vote') ||
    t.includes('governor') || t.includes('mayor') || t.includes('prime minister') ||
    t.includes('parliament') || t.includes('macron') || t.includes('starmer') ||
    t.includes('xi jinping') || t.includes('putin') || t.includes('zelensky') ||
    t.includes('ukraine') || t.includes('russia') || t.includes('nato') ||
    t.includes('tariff') || t.includes('sanction') || t.includes('deport') ||
    t.includes('ceasefire') || t.includes('newsom') || t.includes('midterm') ||
    t.includes('buttigieg') || t.includes('paxton') || t.includes('cornyn') ||
    t.includes('orbán') || t.includes('orban') || t.includes('taiwan') ||
    t.includes('china') || t.includes('epstein')
  ) return 'Politics';

  // Sports
  if (
    t.includes('nba') || t.includes('nfl') || t.includes('mlb') || t.includes('nhl') ||
    t.includes('soccer') || t.includes('football') || t.includes('basketball') ||
    t.includes('super bowl') || t.includes('playoff') || t.includes('championship') ||
    t.includes('premier league') || t.includes('champions league') || t.includes(' epl') ||
    t.includes('world cup') || t.includes('tennis') || t.includes('golf') ||
    t.includes('ufc') || t.includes('boxing') || t.includes('olympic') ||
    t.includes('formula 1') || t.includes('f1 ') || t.includes(' vs.') ||
    t.includes('win the') || t.includes('win their') ||
    (t.includes(' league') && !t.includes('ivy league'))
  ) return 'Sports';

  // Crypto
  if (
    t.includes('bitcoin') || t.includes('btc') || t.includes('ethereum') ||
    t.includes(' eth ') || t.includes('crypto') || t.includes('solana') ||
    t.includes(' sol ') || t.includes('blockchain') || t.includes('defi') ||
    t.includes('nft') || t.includes('coinbase') || t.includes('airdrop') ||
    t.includes('memecoin') || t.includes('web3') || t.includes('token') ||
    t.includes('pump.fun') || t.includes('hyperliquid') || t.includes('stablecoin') ||
    t.includes('altcoin') || t.includes('robinhood') || t.includes('insider trading') ||
    t.includes('dex') || t.includes('fdv') || t.includes('market cap') && t.includes('launch')
  ) return 'Crypto';

  // Pop Culture
  if (
    t.includes('oscar') || t.includes('grammy') || t.includes('emmy') ||
    t.includes('golden globe') || t.includes('taylor swift') || t.includes('beyoncé') ||
    t.includes('celebrity') || t.includes('movie') || t.includes('film') ||
    t.includes('album') || t.includes('song of the year') || t.includes('best picture') ||
    t.includes('netflix') || t.includes('spotify') || t.includes('box office') ||
    t.includes('award') && (t.includes('music') || t.includes('film') || t.includes('tv'))
  ) return 'Pop Culture';

  // Science
  if (
    t.includes('openai') || t.includes('claude') || t.includes('deepseek') ||
    t.includes('gpt') || t.includes('anthropic') || t.includes('llm') ||
    t.includes('gemini') || t.includes('ai model') || t.includes('spacex') ||
    t.includes('nasa') || t.includes('rocket') || t.includes('satellite') ||
    t.includes('fda') || t.includes('vaccine') || t.includes('clinical trial') ||
    t.includes('drug approval') || t.includes('cancer') || t.includes('nuclear') ||
    (t.includes('ai') && (t.includes('model') || t.includes('benchmark') || t.includes('release')))
  ) return 'Science';

  // Business
  if (
    t.includes('google') || t.includes('microsoft') || t.includes('apple') ||
    t.includes('amazon') || t.includes('meta') || t.includes('nvidia') ||
    t.includes('tesla') || t.includes('ipo') || t.includes('merger') ||
    t.includes('acquisition') || t.includes('earnings') || t.includes('fed ') ||
    t.includes('federal reserve') || t.includes('rate cut') || t.includes('recession') ||
    t.includes('inflation') || t.includes('etf') || t.includes('gdp') ||
    t.includes('s&p') || t.includes('nasdaq') || t.includes('dow ') ||
    t.includes('ceo') || t.includes('billion') || t.includes('stock price')
  ) return 'Business';

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

async function fetchActiveMarkets(): Promise<any[]> {
  try {
    const res = await fetch(
      'https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume&ascending=false&limit=100',
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
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

    const [positions, trades, rewardsRaw, valueData, activity, onChainUsdc, activeMarkets] = await Promise.all([
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
      fetchActiveMarkets().catch(() => []),
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

    // Phase 4: book zero-resolution losses.
    // Any remaining cost for a conditionId that no longer appears in the positions API
    // means the market settled against the user (resolved to $0, no REDEEM issued).
    // These are genuinely realised losses — reclassify them out of unrealised.
    const positionConditionIds = new Set(
      (Array.isArray(positions) ? positions : []).map((p: any) => p.conditionId).filter(Boolean)
    );
    let zeroResolutionLoss = 0;
    for (const [cid, state] of Object.entries(costBasis)) {
      if (!positionConditionIds.has(cid) && state.totalCost > 0.01) {
        zeroResolutionLoss -= state.totalCost; // negative: these are losses
        state.totalCost = 0;
        state.size = 0;
      }
    }

    // All-time totals derived from full activity reconstruction.
    const remainingCost = Object.values(costBasis).reduce((s, st) => s + st.totalCost, 0);
    const allTimeUnrealized = positionsValue - remainingCost; // open mark-to-market vs cost only

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

    const allTimeRealized = realizedFlow(0) + zeroResolutionLoss;
    const allTimeNet      = allTimeRealized + allTimeUnrealized;

    // === Suggested Markets: profile user's trading behaviour ===
    // Build category distribution and keyword frequency from BUY events
    const buyEvents = sortedActivity.filter((a: any) => a.type === 'TRADE' && a.side === 'BUY');
    const totalBuyCount = buyEvents.length || 1;

    const catBuyCount: Record<string, number> = {};
    for (const a of buyEvents) {
      const cat = autoCategorize(a.title || '');
      catBuyCount[cat] = (catBuyCount[cat] || 0) + 1;
    }

    const stopWords = new Set(['the','a','an','is','in','on','at','to','for','of','and','or','by','be','will','with','from','as','it','this','that','was','are','has','have','had','do','did','not','no','can','get','its','may','who','how','what','when','which','than','up','if','after','before','during','their','they','he','she','we','you','your','his','her','our','about','over','into','then','more','also','been','would','could','should','just','its','vs','does']);
    const kwCount: Record<string, number> = {};
    for (const a of buyEvents) {
      const words = (a.title || '').toLowerCase().split(/\W+/).filter((w: string) => w.length > 3 && !stopWords.has(w));
      for (const w of words) {
        kwCount[w] = (kwCount[w] || 0) + 1;
      }
    }
    const topKeywords = Object.entries(kwCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([w]) => w);

    const buyPrices = buyEvents
      .map((a: any) => a.price || 0)
      .filter((p: number) => p > 0 && p < 1)
      .sort((a: number, b: number) => a - b);
    const avgBuyPrice = buyPrices.length > 0
      ? buyPrices.reduce((s: number, p: number) => s + p, 0) / buyPrices.length
      : 0.5;

    // Exclude all conditionIds the user has ever interacted with
    const tradedConditionIds = new Set(activity.map((a: any) => a.conditionId).filter(Boolean));

    const suggestions = (activeMarkets as any[])
      .filter((m: any) => m.conditionId && !tradedConditionIds.has(m.conditionId))
      .map((m: any) => {
        const title = m.question || '';
        const category = autoCategorize(title);

        // Category score: proportion of user's buys in this category
        const catScore = Math.min((catBuyCount[category] || 0) / totalBuyCount * 3, 1);

        // Keyword score: how many of user's top keywords appear in this title
        const titleWords = new Set(title.toLowerCase().split(/\W+/).filter((w: string) => w.length > 3));
        const matchedKws = topKeywords.filter(kw => titleWords.has(kw));
        const kwScore = Math.min(matchedKws.length / 3, 1);

        // Price fit: is the YES price near user's average buy price?
        let yesPrice = 0.5;
        try {
          const rawPrices = m.outcomePrices;
          const prices = typeof rawPrices === 'string' ? JSON.parse(rawPrices) : (Array.isArray(rawPrices) ? rawPrices : []);
          yesPrice = parseFloat(prices[0]) || 0.5;
        } catch { /* keep 0.5 */ }
        const priceScore = Math.max(0, 1 - Math.abs(yesPrice - avgBuyPrice) * 4);

        // Volume score: prefer more liquid markets
        const vol = typeof m.volume === 'string' ? parseFloat(m.volume) || 0 : (m.volume || 0);
        const volScore = Math.min(vol / 1000000, 1);

        const score = catScore * 0.40 + kwScore * 0.35 + volScore * 0.15 + priceScore * 0.10;

        const reasons: string[] = [];
        if (catBuyCount[category] > 0) {
          reasons.push(`${category} (${((catBuyCount[category] / totalBuyCount) * 100).toFixed(0)}% of trades)`);
        }
        if (matchedKws.length > 0) {
          reasons.push(`matches: ${matchedKws.slice(0, 3).join(', ')}`);
        }

        return {
          title,
          slug: m.slug || '',
          eventSlug: m.eventSlug || m.event?.slug || m.slug || '',
          category,
          volume: vol,
          yesPrice,
          score,
          reason: reasons.join(' · ') || category,
        };
      })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 20);

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
        all:   { ...flowBreakdown(0),         total: allTimeRealized         },
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
      suggestions,
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
