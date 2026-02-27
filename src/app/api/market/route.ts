import { NextRequest, NextResponse } from 'next/server';

function parsePolymarketSlug(raw: string): { type: 'event' | 'market'; slug: string } | null {
  try {
    const u = raw.includes('polymarket.com') ? new URL(raw) : new URL('https://polymarket.com/' + raw);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && (parts[0] === 'event' || parts[0] === 'market')) {
      return { type: parts[0] as 'event' | 'market', slug: parts[1] };
    }
    return null;
  } catch {
    return null;
  }
}

function parseNum(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  return 0;
}

function extractTokenId(m: any): string | null {
  // Gamma API stores token IDs in either clobTokenIds or tokens array
  try {
    if (m.clobTokenIds) {
      const ids = typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) : m.clobTokenIds;
      if (Array.isArray(ids) && ids[0]) return String(ids[0]);
    }
  } catch {}
  if (Array.isArray(m.tokens)) {
    const yes = m.tokens.find((t: any) => t.outcome === 'Yes' || t.outcome === 'YES');
    return yes?.token_id ?? m.tokens[0]?.token_id ?? null;
  }
  return null;
}

async function fetchOrderBook(tokenId: string): Promise<{ bids: any[]; asks: any[]; spread: number | null; midpoint: number | null } | null> {
  try {
    const res = await fetch(`https://clob.polymarket.com/book?token_id=${tokenId}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const book = await res.json();
    const bids = (book.bids || []).slice(0, 10).map((b: any) => ({
      price: parseFloat(b.price),
      size: parseFloat(b.size),
    }));
    const asks = (book.asks || []).slice(0, 10).map((a: any) => ({
      price: parseFloat(a.price),
      size: parseFloat(a.size),
    }));
    const bestBid = bids[0]?.price ?? null;
    const bestAsk = asks[0]?.price ?? null;
    return {
      bids,
      asks,
      spread: bestBid != null && bestAsk != null ? +(bestAsk - bestBid).toFixed(4) : null,
      midpoint: bestBid != null && bestAsk != null ? +((bestBid + bestAsk) / 2).toFixed(4) : null,
    };
  } catch {
    return null;
  }
}

async function enrichMarket(m: any) {
  const tokenId = extractTokenId(m);
  const orderBook = tokenId ? await fetchOrderBook(tokenId) : null;

  const rewardEpoch = m.rewardEpoch || 0;
  const rewardsMinSize = parseNum(m.rewardsMinSize);
  const rewardsMaxSpread = parseNum(m.rewardsMaxSpread);
  const rewardsEnabled = rewardEpoch > 0 || rewardsMinSize > 0;

  return {
    question: m.question,
    conditionId: m.conditionId,
    volume: parseNum(m.volume),
    volume24h: parseNum(m.volume24hr),
    liquidity: parseNum(m.liquidity),
    outcomePrices: m.outcomePrices,
    active: m.active,
    closed: m.closed,
    orderBook,
    rewards: rewardsEnabled
      ? { enabled: true, minSize: rewardsMinSize, maxSpread: rewardsMaxSpread, epoch: rewardEpoch }
      : null,
  };
}

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url') || '';
  const parsed = parsePolymarketSlug(urlParam.trim());
  if (!parsed) {
    return NextResponse.json(
      { error: 'Invalid Polymarket URL. Use https://polymarket.com/event/… or /market/…' },
      { status: 400 }
    );
  }

  try {
    let eventData: any = null;
    let rawMarkets: any[] = [];

    if (parsed.type === 'event') {
      // Fetch event metadata + full market objects in parallel
      const [eRes, mRes] = await Promise.all([
        fetch(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(parsed.slug)}&limit=1`, {
          next: { revalidate: 60 },
        }),
        fetch(`https://gamma-api.polymarket.com/markets?event_slug=${encodeURIComponent(parsed.slug)}&limit=50`, {
          next: { revalidate: 60 },
        }),
      ]);
      if (!eRes.ok) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      const eData = await eRes.json();
      eventData = Array.isArray(eData) ? eData[0] : eData;
      if (!eventData) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

      if (mRes.ok) {
        const mData = await mRes.json();
        rawMarkets = Array.isArray(mData) ? mData : [];
      }
      // Fallback to embedded markets (may lack some fields like clobTokenIds)
      if (rawMarkets.length === 0) rawMarkets = eventData.markets || [];
    } else {
      // Fetch the specific market by slug
      const mRes = await fetch(
        `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(parsed.slug)}&limit=1`,
        { next: { revalidate: 60 } }
      );
      if (!mRes.ok) return NextResponse.json({ error: 'Market not found' }, { status: 404 });
      const mData = await mRes.json();
      const market = Array.isArray(mData) ? mData[0] : mData;
      if (!market) return NextResponse.json({ error: 'Market not found' }, { status: 404 });
      rawMarkets = [market];

      // Fetch parent event metadata
      if (market.eventSlug) {
        const eRes = await fetch(
          `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(market.eventSlug)}&limit=1`,
          { next: { revalidate: 60 } }
        );
        if (eRes.ok) {
          const eData = await eRes.json();
          eventData = Array.isArray(eData) ? eData[0] : eData;
        }
      }
      if (!eventData) {
        eventData = {
          title: market.question,
          slug: market.slug,
          startDate: market.startDate,
          endDate: market.endDate,
        };
      }
    }

    // Enrich all markets with order book + rewards (parallel)
    const markets = await Promise.all(rawMarkets.map(enrichMarket));

    const totalVolume = markets.reduce((s, m) => s + m.volume, 0) || parseNum(eventData.volume);
    const totalVolume24h = markets.reduce((s, m) => s + m.volume24h, 0) || parseNum(eventData.volume24hr);
    const totalLiquidity = markets.reduce((s, m) => s + m.liquidity, 0) || parseNum(eventData.liquidity);

    return NextResponse.json({
      type: parsed.type,
      title: eventData.title || markets[0]?.question || '—',
      slug: eventData.slug || parsed.slug,
      startDate: eventData.startDate || null,
      endDate: eventData.endDate || null,
      volume: totalVolume,
      volume24h: totalVolume24h,
      liquidity: totalLiquidity,
      markets,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
