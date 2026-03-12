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
    t.includes('dex') || t.includes('fdv') || (t.includes('market cap') && t.includes('launch')) ||
    t.includes('xrp') || t.includes('ripple') || t.includes('dogecoin') || t.includes('doge') ||
    t.includes('bnb') || t.includes('cardano') || t.includes('polkadot') ||
    t.includes('avalanche') || t.includes('avax') || t.includes('chainlink') ||
    t.includes('cosmos') || t.includes('near protocol') || t.includes('sui ') ||
    t.includes('aptos') || t.includes('pepe') || t.includes('shiba') ||
    t.includes('tron') || t.includes('stellar') || t.includes('monero') ||
    t.includes('litecoin') || t.includes('tether') || t.includes('kraken') ||
    t.includes('binance') || t.includes('microstrategy')
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

// Fetches Gamma markets with LP requirements set — used to build a condition_id → liquidity map.
// rewardsMinSize=1 filters to only markets that have an active LP programme configured.
// 5 pages × 500 = up to 2500 markets, cached 1 hour.
async function fetchGammaLiquidityMarkets(): Promise<any[]> {
  const pages = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      fetch(`https://gamma-api.polymarket.com/markets?rewardsMinSize=1&active=true&closed=false&limit=500&offset=${i * 500}`, {
        next: { revalidate: 3600 },
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PolyDash/1.0)' },
      }).then(r => r.ok ? r.json() : []).then((d: any) => Array.isArray(d) ? d : []).catch(() => [])
    )
  );
  const all: any[] = [];
  for (const page of pages) {
    if (page.length === 0) break;
    all.push(...page);
  }
  return all;
}

// Exhaustively fetches all Polymarket reward markets (up to 20 pages × 100).
// Cached for 1 hour — the list changes rarely and full coverage matters more than freshness.
async function fetchAllRewardMarkets(): Promise<any[]> {
  const pages = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      fetch(`https://polymarket.com/api/rewards/markets?limit=100&offset=${i * 100}`, {
        next: { revalidate: 3600 },
      }).then(r => r.ok ? r.json() : {}).then((d: any) => Array.isArray(d?.data) ? d.data : []).catch(() => [])
    )
  );
  const all: any[] = [];
  for (const page of pages) {
    if (page.length === 0) break; // stop at first empty page
    all.push(...page);
  }
  return all;
}

// Fetches crypto-tagged reward markets specifically — there are 1200+ spread across all pages
// so we can't rely on the unfiltered fetch to capture them. 30 pages × 100 = up to 3000.
async function fetchCryptoRewardMarkets(): Promise<any[]> {
  const pages = await Promise.all(
    Array.from({ length: 30 }, (_, i) =>
      fetch(`https://polymarket.com/api/rewards/markets?tag_slug=crypto&limit=100&offset=${i * 100}`, {
        next: { revalidate: 3600 },
      }).then(r => r.ok ? r.json() : {}).then((d: any) => Array.isArray(d?.data) ? d.data : []).catch(() => [])
    )
  );
  const all: any[] = [];
  for (const page of pages) {
    if (page.length === 0) break;
    all.push(...page);
  }
  return all;
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

const STOP_WORDS = new Set(['the','a','an','is','in','on','at','to','for','of','and','or','by','be','will','with','from','as','it','this','that','was','are','has','have','had','do','did','not','no','can','get','its','may','who','how','what','when','which','than','up','if','after','before','during','their','they','he','she','we','you','your','his','her','our','about','over','into','then','more','also','been','would','could','should','just','does','make','some','such','only','market','markets','percent','between','first','year','says','said','have','than','other','much','new','per','hit','high','low','win','lose','any','all','one','two','three','next','last','ever','least','most']);

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

// Markets sorted by 24h volume — these are the ones news is driving right now
async function fetchTrendingMarkets(): Promise<any[]> {
  try {
    const res = await fetch(
      'https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume24hr&ascending=false&limit=150',
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// BBC World News RSS → keyword weights (word → fraction of headlines it appears in)
async function fetchNewsKeywordWeights(): Promise<Record<string, number>> {
  try {
    const res = await fetch('https://feeds.bbci.co.uk/news/world/rss.xml', {
      next: { revalidate: 900 },
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PolyDash/1.0)' },
    });
    if (!res.ok) return {};
    const xml = await res.text();
    // Extract titles — handles both plain and CDATA-wrapped
    const titleMatches = [...xml.matchAll(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g)];
    const headlines = titleMatches.map(m => m[1].trim()).filter(Boolean).slice(1, 40);
    // Count how many headlines contain each keyword
    const freq: Record<string, number> = {};
    for (const h of headlines) {
      const words = new Set(h.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOP_WORDS.has(w)));
      for (const w of words) freq[w] = (freq[w] || 0) + 1;
    }
    // Normalise: weight = count / max_count → [0, 1]
    const maxFreq = Math.max(...Object.values(freq), 1);
    const weights: Record<string, number> = {};
    for (const [w, f] of Object.entries(freq)) weights[w] = f / maxFreq;
    return weights;
  } catch {
    return {};
  }
}

export async function GET() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const cutoff1d = now - 86400;
    const cutoff7d = now - 7 * 86400;
    const cutoff30d = now - 30 * 86400;

    const [positions, trades, rewardsEarning, rewardsCryptoTag, rewardsTopRaw, valueData, activity, onChainUsdc, activeMarkets, trendingMarkets, newsKwWeights, gammaLiquidityMarkets, allRewardMarkets, cryptoRewardMarkets] = await Promise.all([
      fetch(
        `https://data-api.polymarket.com/positions?user=${WALLET}&sizeThreshold=0&limit=500`,
        { next: { revalidate: 60 } }
      ).then(r => r.json()),
      fetchAllTrades(),
      // With maker filter → earning_percentage per market for this wallet
      fetch(`https://polymarket.com/api/rewards/markets?maker=${WALLET}&limit=100`, {
        next: { revalidate: 300 },
      }).then(r => r.json()).then(d => d?.data || []).catch(() => []),
      // Crypto tag-filtered → native API filter for crypto category markets
      fetch(`https://polymarket.com/api/rewards/markets?tag_slug=crypto&limit=100`, {
        next: { revalidate: 300 },
      }).then(r => r.json()).then(d => d?.data || []).catch(() => []),
      // Unfiltered top-100 for existing LP rewards panel (5-min freshness)
      fetch(`https://polymarket.com/api/rewards/markets?limit=100`, {
        next: { revalidate: 300 },
      }).then(r => r.json()).then(d => d?.data || []).catch(() => []),
      fetch(`https://data-api.polymarket.com/value?user=${WALLET}`, {
        next: { revalidate: 60 },
      }).then(r => r.json()).then(d => Array.isArray(d) ? d[0] : d).catch(() => null),
      fetchActivity(),
      fetchOnChainUsdc(WALLET).catch(() => 0),
      fetchActiveMarkets().catch(() => []),
      fetchTrendingMarkets().catch(() => []),
      fetchNewsKeywordWeights().catch(() => ({})),
      // Gamma markets with LP config — for condition_id → liquidity map (5 pages × 500, 1h cache)
      fetchGammaLiquidityMarkets(),
      // Exhaustive rewards market list — 20 pages × 100, cached 1 hour
      fetchAllRewardMarkets(),
      // Crypto-tagged rewards specifically — 30 pages × 100, captures 1200+ crypto markets
      fetchCryptoRewardMarkets(),
    ]);

    // Merge crypto tag-filtered results with top-raw, deduplicating by condition_id.
    // If the rewards API honours tag_slug=crypto, rewardsCryptoTag will contain many markets
    // that the unfiltered first-100 fetch would miss entirely.
    const seenRewardCids = new Set<string>();
    const rewardsAll = [...(rewardsCryptoTag as any[]), ...(rewardsTopRaw as any[])].filter((m: any) => {
      if (!m.condition_id || seenRewardCids.has(m.condition_id)) return false;
      seenRewardCids.add(m.condition_id);
      return true;
    });

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
    // Markets that settled against the user leave orphaned cost basis with no REDEEM to drain it.
    // Two cases to catch:
    //  (a) cid completely absent from the positions API — market fully gone
    //  (b) cid present but avgPrice×size < $0.01 — dust shares from floating-point rounding;
    //      the market effectively resolved but a tiny residual prevents (a) from firing
    const positionApiCost: Record<string, number> = {};
    for (const p of (Array.isArray(positions) ? positions : [])) {
      if (p.conditionId) positionApiCost[p.conditionId] = (p.avgPrice || 0) * (p.size || 0);
    }
    let zeroResolutionLoss = 0;
    for (const [cid, state] of Object.entries(costBasis)) {
      const apiCost = positionApiCost[cid] ?? null;
      const isResolved = apiCost === null || apiCost < 0.01;
      if (isResolved && state.totalCost > 0.01) {
        zeroResolutionLoss -= state.totalCost; // negative: these are losses
        state.totalCost = 0;
        state.size = 0;
      }
    }

    // All-time totals derived from full activity reconstruction.
    const remainingCost = Object.values(costBasis).reduce((s, st) => s + st.totalCost, 0);
    // Use positions API's own cashPnl (currentValue − avgPrice×size) as authoritative unrealized.
    // The activity-based remainingCost can drift (truncated history, missing redeems, etc.)
    // and was producing a ~$1.4k overstatement of losses vs Polymarket's own numbers.
    const allTimeUnrealized = (Array.isArray(positions) ? positions : [])
      .reduce((s: number, p: any) => s + (p.cashPnl || 0), 0);

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

    // Volume breakdown per period
    function volumeBreakdown(cutoff: number) {
      let buyVol = 0, sellVol = 0, buyShares = 0, sellShares = 0, tradeCount = 0;
      for (const a of sortedActivity) {
        if (a.type !== 'TRADE' || (a.timestamp || 0) < cutoff) continue;
        tradeCount++;
        const usdc   = a.usdcSize || 0;
        const shares = Math.abs(a.size || 0);
        if (a.side === 'BUY')  { buyVol  += usdc; buyShares  += shares; }
        if (a.side === 'SELL') { sellVol += usdc; sellShares += shares; }
      }
      return {
        buyVol, sellVol, total: buyVol + sellVol,
        buyShares, sellShares, totalShares: buyShares + sellShares,
        tradeCount,
      };
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

    // === Suggested Markets ===
    const buyEvents = sortedActivity.filter((a: any) => a.type === 'TRADE' && a.side === 'BUY');

    // ── 1. Category stats ──────────────────────────────────────────────────────
    const catStats: Record<string, { usdc: number; pnl: number; count: number }> = {};
    for (const a of buyEvents) {
      const cat = autoCategorize(a.title || '');
      if (!catStats[cat]) catStats[cat] = { usdc: 0, pnl: 0, count: 0 };
      catStats[cat].usdc  += a.usdcSize || 0;
      catStats[cat].count += 1;
    }
    for (const sp of sellProfits) {
      const cat = autoCategorize(sp.title);
      if (!catStats[cat]) catStats[cat] = { usdc: 0, pnl: 0, count: 0 };
      catStats[cat].pnl += sp.profit;
    }
    for (const a of sortedActivity) {
      if (a.type !== 'REDEEM' || !a.conditionId) continue;
      const avgCost = finalAvgCost[a.conditionId] ?? 0;
      const profit  = (a.usdcSize || 0) - Math.abs(a.size || 0) * avgCost;
      const cat = autoCategorize(a.title || '');
      if (!catStats[cat]) catStats[cat] = { usdc: 0, pnl: 0, count: 0 };
      catStats[cat].pnl += profit;
    }
    const totalUsdc  = Object.values(catStats).reduce((s, c) => s + c.usdc, 0) || 1;
    const allEdges   = Object.values(catStats).map(c => c.usdc > 0 ? c.pnl / c.usdc : 0);
    const maxEdge    = Math.max(...allEdges, 0.001);
    const minEdgeAbs = Math.abs(Math.min(...allEdges, -0.001));

    // ── 2. HARD CATEGORY GATE ─────────────────────────────────────────────────
    // Only suggest markets in categories where the user has meaningfully traded.
    // This prevents Sports, Pop Culture etc from appearing if Pascal never bets there.
    const allowedCategories = new Set(
      Object.entries(catStats)
        .filter(([, s]) => (s.usdc / totalUsdc) >= 0.03 || s.count >= 10)
        .map(([cat]) => cat)
    );

    function getCatAffinityScore(cat: string): number {
      const s = catStats[cat];
      if (!s || s.usdc === 0) return 0;
      const usdcShare = Math.min((s.usdc / totalUsdc) * 5, 1);
      const edge      = s.pnl / s.usdc;
      const edgeNorm  = edge >= 0
        ? 0.5 + (edge / maxEdge) * 0.5
        : Math.max(0, 0.5 - (Math.abs(edge) / minEdgeAbs) * 0.5);
      return usdcShare * 0.6 + edgeNorm * 0.4;
    }

    // ── 3. Category-scoped entity maps ────────────────────────────────────────
    // Built per-category so "elon" from Crypto trades CANNOT boost tweet-count
    // markets in Other/PopCulture — entity signals are strictly scoped.
    const catEntityMap: Record<string, Record<string, number>> = {};
    for (const a of buyEvents) {
      const cat = autoCategorize(a.title || '');
      if (!allowedCategories.has(cat)) continue;
      if (!catEntityMap[cat]) catEntityMap[cat] = {};
      const ageDays = (now - (a.timestamp || 0)) / 86400;
      const recency = ageDays < 7 ? 2.0 : ageDays < 30 ? 1.0 : ageDays < 90 ? 0.5 : 0.2;
      const usdc    = a.usdcSize || 1;
      for (const w of (a.title || '').toLowerCase().split(/\W+/)) {
        if (w.length > 3 && !STOP_WORDS.has(w))
          catEntityMap[cat][w] = (catEntityMap[cat][w] || 0) + usdc * recency;
      }
    }
    const catEntityMax: Record<string, number> = {};
    for (const [cat, map] of Object.entries(catEntityMap))
      catEntityMax[cat] = Math.max(...Object.values(map), 1);

    function getCatEntityScore(cat: string, titleWords: string[]): number {
      const map  = catEntityMap[cat];
      const maxW = catEntityMax[cat];
      if (!map || !maxW) return 0;
      let score = 0;
      for (const w of titleWords) score += (map[w] || 0) / maxW;
      return Math.min(score / 2.5, 1);
    }

    // ── 4. Price range profile: USDC-weighted across 10¢ buckets ──────────────
    const priceBuckets = new Array(10).fill(0);
    let totalBuyUsdc = 0;
    for (const a of buyEvents) {
      const p = a.price || 0;
      if (p <= 0 || p >= 1) continue;
      const b = Math.min(Math.floor(p * 10), 9);
      priceBuckets[b] += a.usdcSize || 1;
      totalBuyUsdc     += a.usdcSize || 1;
    }
    const priceProfile      = priceBuckets.map(b => totalBuyUsdc > 0 ? b / totalBuyUsdc : 0);
    const topBucketIndices  = [...priceProfile.map((v, i) => ({ v, i }))]
      .sort((a, b) => b.v - a.v).slice(0, 2).map(x => x.i);
    function getPriceScore(yesPrice: number): number {
      if (yesPrice <= 0 || yesPrice >= 1) return 0;
      const b  = Math.min(Math.floor(yesPrice * 10), 9);
      const sc = (priceProfile[b] || 0)
        + (b > 0 ? (priceProfile[b - 1] || 0) * 0.5 : 0)
        + (b < 9 ? (priceProfile[b + 1] || 0) * 0.5 : 0);
      return Math.min(sc * 3, 1);
    }

    // ── 5. Horizon profile: typical hold period (first BUY → REDEEM) ──────────
    const firstBuyTs: Record<string, number> = {};
    for (const a of sortedActivity) {
      if (a.type === 'TRADE' && a.side === 'BUY' && a.conditionId && !firstBuyTs[a.conditionId])
        firstBuyTs[a.conditionId] = a.timestamp || 0;
    }
    const horizonDaysArr: number[] = [];
    for (const a of sortedActivity) {
      if (a.type === 'REDEEM' && a.conditionId && firstBuyTs[a.conditionId]) {
        const d = ((a.timestamp || 0) - firstBuyTs[a.conditionId]) / 86400;
        if (d > 0 && d < 365) horizonDaysArr.push(d);
      }
    }
    horizonDaysArr.sort((a, b) => a - b);
    const medianHorizon = horizonDaysArr.length > 0
      ? horizonDaysArr[Math.floor(horizonDaysArr.length / 2)] : 30;
    function getHorizonScore(endDateStr: string | null | undefined): number {
      if (!endDateStr) return 0.5;
      const daysLeft = (new Date(endDateStr).getTime() - Date.now()) / 86400000;
      if (daysLeft < 0) return 0;
      return Math.exp(-0.5 * Math.pow((daysLeft - medianHorizon) / Math.max(medianHorizon * 0.8, 7), 2));
    }

    // ── 6. Liquidity floor from median bet size ────────────────────────────────
    const buySizes = buyEvents.map((a: any) => a.usdcSize || 0).filter((u: number) => u > 0).sort((a: number, b: number) => a - b);
    const medianBetSize  = buySizes.length > 0 ? buySizes[Math.floor(buySizes.length / 2)] : 20;
    const liquidityFloor = medianBetSize * 20;

    // ── 7. Merge candidate pools ───────────────────────────────────────────────
    const tradedConditionIds = new Set(activity.map((a: any) => a.conditionId).filter(Boolean));
    const seenCandidateCids  = new Set<string>();
    const candidateMarkets: any[] = [];
    for (const m of [...(trendingMarkets as any[]), ...(activeMarkets as any[])]) {
      if (!m.conditionId || seenCandidateCids.has(m.conditionId)) continue;
      seenCandidateCids.add(m.conditionId);
      candidateMarkets.push(m);
    }

    // ── 8. Score ───────────────────────────────────────────────────────────────
    const scoredMarkets = candidateMarkets
      .filter((m: any) => {
        if (tradedConditionIds.has(m.conditionId)) return false;
        const vol = parseFloat(String(m.volume)) || 0;
        if (vol < liquidityFloor) return false;
        // Hard gate: skip categories the user has never meaningfully traded
        const cat = autoCategorize(m.question || '');
        if (!allowedCategories.has(cat)) return false;
        return true;
      })
      .map((m: any) => {
        const title      = m.question || '';
        const category   = autoCategorize(title);
        const titleWords = title.toLowerCase().split(/\W+/).filter((w: string) => w.length > 3 && !STOP_WORDS.has(w));

        let yesPrice = 0.5;
        try {
          const rawPrices = m.outcomePrices;
          const prices = typeof rawPrices === 'string' ? JSON.parse(rawPrices) : (rawPrices || []);
          yesPrice = parseFloat(prices[0]) || 0.5;
        } catch { /* keep 0.5 */ }
        if (yesPrice <= 0.01 || yesPrice >= 0.99) return null;

        const vol    = parseFloat(String(m.volume))                    || 0;
        const vol24h = parseFloat(String(m.volume24hr ?? m.volume24h)) || 0;

        const catScore = getCatAffinityScore(category);
        const entScore = getCatEntityScore(category, titleWords); // category-scoped
        const priceScr = getPriceScore(yesPrice);
        const horizScr = getHorizonScore(m.endDate || m.endDateIso);

        // News: tiny tiebreaker, only within allowed categories (already enforced by gate)
        let rawNewsScore = 0;
        const newsMatchWords: string[] = [];
        for (const w of titleWords) {
          const nw = (newsKwWeights as Record<string, number>)[w];
          if (nw) { rawNewsScore += nw; newsMatchWords.push(w); }
        }
        const newsScr = Math.min(rawNewsScore / 2, 1);

        // No trend or liquidity signals — the category gate already ensures relevance
        const score = catScore * 0.35
                    + entScore * 0.35
                    + priceScr * 0.20
                    + horizScr * 0.08
                    + newsScr  * 0.02;

        const priceMatch       = topBucketIndices.includes(Math.min(Math.floor(yesPrice * 10), 9));
        const endStr           = m.endDate || m.endDateIso || null;
        const daysToResolution = endStr
          ? Math.round((new Date(endStr).getTime() - Date.now()) / 86400000)
          : null;

        const reasons: string[] = [];
        const cs = catStats[category];
        if (cs && cs.usdc > 0) {
          const pct    = Math.round((cs.usdc / totalUsdc) * 100);
          const pnlStr = cs.pnl >= 0 ? `+$${Math.round(cs.pnl)}` : `-$${Math.abs(Math.round(cs.pnl))}`;
          reasons.push(`${pct}% of vol in ${category} (${pnlStr})`);
        }
        if (priceMatch) reasons.push(`${Math.round(yesPrice * 100)}¢ YES — your price range`);
        const deduped = [...new Set(newsMatchWords)];
        if (deduped.length > 0 && newsScr > 0.3) reasons.push(`news: ${deduped.slice(0, 2).join(', ')}`);

        const vol24hSpike = vol > 1000 && (vol24h / vol) > 0.15;

        return {
          title,
          slug: m.slug || '',
          eventSlug: m.eventSlug || m.event?.slug || m.slug || '',
          category,
          volume: vol,
          volume24h: vol24h,
          yesPrice,
          score,
          reason: reasons.slice(0, 2).join(' · ') || category,
          newsMatch: deduped.slice(0, 3),
          trending: vol24hSpike,
          priceMatch,
          daysToResolution,
        };
      })
      .filter(Boolean)
      .filter((m: any) => m.score > 0.05)
      .sort((a: any, b: any) => b.score - a.score);

    // De-duplicate near-identical titles (keep highest-scoring)
    const seenTitleSigs = new Set<string>();
    const suggestions = scoredMarkets.filter((m: any) => {
      const sig = m.title.toLowerCase()
        .split(/\W+/).filter((w: string) => w.length > 4 && !STOP_WORDS.has(w))
        .slice(0, 4).sort().join('|');
      if (seenTitleSigs.has(sig)) return false;
      seenTitleSigs.add(sig);
      return true;
    }).slice(0, 25);

    // Build a map of condition_id → earning_percentage from the maker-filtered fetch
    const earningMap: Record<string, number> = {};
    for (const m of rewardsEarning as any[]) {
      if (m.condition_id && m.earning_percentage > 0) {
        earningMap[m.condition_id] = m.earning_percentage;
      }
    }

    // Active LP markets: those where user is currently earning
    const activeRewards = (rewardsEarning as any[])
      .filter((m: any) => m.earning_percentage > 0)
      .map((m: any) => ({
        question: m.question,
        event_slug: m.event_slug,
        ratePerDay: m.rewards_config?.[0]?.rate_per_day || 0,
        earningPct: m.earning_percentage,
        competitiveness: m.market_competitiveness,
        category: autoCategorize(m.question),
      }));

    // Crypto-only reward markets, sorted by rate desc, with earning% merged in
    const topRewards = (rewardsAll as any[])
      .filter((m: any) => autoCategorize(m.question) === 'Crypto')
      .sort((a: any, b: any) => (b.rewards_config?.[0]?.rate_per_day || 0) - (a.rewards_config?.[0]?.rate_per_day || 0))
      .map((m: any) => ({
        question: m.question,
        event_slug: m.event_slug,
        ratePerDay: m.rewards_config?.[0]?.rate_per_day || 0,
        earningPct: earningMap[m.condition_id] ?? 0,
        competitiveness: m.market_competitiveness,
        category: autoCategorize(m.question),
      }));

    // === Juicy LP Rewards ===
    // NOTE: Gamma API's clobRewards[].rewardsDailyRate is always a placeholder (0.001).
    // Real rates come from polymarket.com/api/rewards/markets → rewards_config[].rate_per_day.
    // Gamma events pages are used only to build a condition_id → liquidity lookup.

    interface JuicyRewardMarket {
      question: string;
      category: string;
      eventSlug: string;
      marketSlug: string;
      ratePerDay: number;
      liquidity: number;
      volume24h: number;
      volumeTotal: number;
      rewardApy: number;
      volumeTurnover: number;
      juiceScore: number;
      minSize: number;
      maxSpread: number;
      isCryptoTagged: boolean;
    }

    // Build condition_id → liquidity/volume map from Gamma markets (flat list, up to 2500 markets)
    const liquidityMap = new Map<string, number>();
    const volumeTotalMap = new Map<string, number>();
    for (const m of (gammaLiquidityMarkets as any[])) {
      const cid = m.conditionId;
      if (cid) {
        liquidityMap.set(cid, parseFloat(m.liquidity) || 0);
        volumeTotalMap.set(cid, parseFloat(m.volume) || 0);
      }
    }

    // Merge allRewardMarkets + cryptoRewardMarkets, deduplicating by condition_id.
    // cryptoRewardMarkets is a targeted 30-page fetch that captures the 1200+ crypto LP markets
    // that are spread too deep in the unfiltered list for the 20-page fetch to reach.
    const seenMergeCids = new Set<string>();
    const allPolyRewardsMarkets: any[] = [];
    for (const m of [...(allRewardMarkets as any[]), ...(cryptoRewardMarkets as any[])]) {
      if (!m.condition_id || seenMergeCids.has(m.condition_id)) continue;
      seenMergeCids.add(m.condition_id);
      allPolyRewardsMarkets.push(m);
    }

    // Build set of condition_ids that came from the crypto-tagged API endpoint
    const cryptoTaggedCids = new Set<string>();
    for (const m of (cryptoRewardMarkets as any[])) {
      if (m.condition_id) cryptoTaggedCids.add(m.condition_id);
    }

    const seenJuicyCids = new Set<string>();
    const juicyRewards: JuicyRewardMarket[] = [];

    for (const m of allPolyRewardsMarkets) {
      const cid = m.condition_id;
      if (!cid || seenJuicyCids.has(cid)) continue;
      seenJuicyCids.add(cid);

      const totalDailyRate: number = (m.rewards_config || []).reduce((s: number, r: any) => s + (r.rate_per_day || 0), 0);
      if (totalDailyRate < 1.0) continue;

      // market_competitiveness is the total LP size competing for rewards — the correct denominator
      // for APY. Gamma API liquidity is CLOB order-book depth and is 0 for most reward markets.
      const liquidity = (m.market_competitiveness || 0) > 0
        ? (m.market_competitiveness as number)
        : (liquidityMap.get(cid) || 0);
      if (liquidity < 100) continue;

      const volume24h = parseFloat(m.volume_24hr) || 0;
      const volumeTotal = volumeTotalMap.get(cid) || 0;

      const rewardApy = (totalDailyRate * 365 / liquidity) * 100;
      const volumeTurnover = volume24h / liquidity;
      const juiceScore = rewardApy / (1 + volumeTurnover);

      juicyRewards.push({
        question: m.question || '',
        category: autoCategorize(m.question || ''),
        eventSlug: m.event_slug || '',
        marketSlug: m.market_slug || '',
        ratePerDay: totalDailyRate,
        liquidity,
        volume24h,
        volumeTotal,
        rewardApy,
        volumeTurnover,
        juiceScore,
        minSize: m.rewards_min_size || 0,
        maxSpread: m.rewards_max_spread || 0,
        isCryptoTagged: cryptoTaggedCids.has(cid),
      });
    }
    juicyRewards.sort((a, b) => b.juiceScore - a.juiceScore);
    const juicyRewardsTop = juicyRewards.slice(0, 30);
    const juicyRewardsCrypto = juicyRewards
      .filter(m => m.category === 'Crypto' || (m.isCryptoTagged && m.category === 'Other'))
      .slice(0, 5);
    const _debugJuicy = {
      cryptoRawCount: cryptoTaggedCids.size,
      cryptoInJuicy: juicyRewards.filter(m => m.isCryptoTagged).length,
      juicyTotal: juicyRewards.length,
    };

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
      volume: {
        day:   volumeBreakdown(cutoff1d),
        week:  volumeBreakdown(cutoff7d),
        month: volumeBreakdown(cutoff30d),
        all:   volumeBreakdown(0),
      },
      categoryPnl,
      positions: categorized.sort((a: any, b: any) => b.currentValue - a.currentValue),
      rewards: {
        active: activeRewards,
        top: topRewards,
      },
      juicyRewards: juicyRewardsTop,
      juicyRewardsCrypto: juicyRewardsCrypto,
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
      _debug: _debugJuicy,
    });
  } catch (e) {
    console.error('Dashboard API error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
