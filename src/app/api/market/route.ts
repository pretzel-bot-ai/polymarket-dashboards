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

function parseVol(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  return 0;
}

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url') || '';
  const parsed = parsePolymarketSlug(urlParam.trim());
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid Polymarket URL. Use https://polymarket.com/event/… or /market/…' }, { status: 400 });
  }

  try {
    let event: any = null;
    let markets: any[] = [];

    if (parsed.type === 'event') {
      const res = await fetch(
        `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(parsed.slug)}&limit=1`,
        { next: { revalidate: 60 } }
      );
      if (!res.ok) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      const data = await res.json();
      event = Array.isArray(data) ? data[0] : data;
      if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      markets = event.markets || [];
    } else {
      // market slug — fetch the market, then its parent event
      const mRes = await fetch(
        `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(parsed.slug)}&limit=1`,
        { next: { revalidate: 60 } }
      );
      if (!mRes.ok) return NextResponse.json({ error: 'Market not found' }, { status: 404 });
      const mData = await mRes.json();
      const market = Array.isArray(mData) ? mData[0] : mData;
      if (!market) return NextResponse.json({ error: 'Market not found' }, { status: 404 });

      // Try to fetch parent event for richer data
      if (market.eventSlug) {
        const eRes = await fetch(
          `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(market.eventSlug)}&limit=1`,
          { next: { revalidate: 60 } }
        );
        if (eRes.ok) {
          const eData = await eRes.json();
          event = Array.isArray(eData) ? eData[0] : eData;
          markets = event?.markets || [market];
        }
      }
      if (!event) {
        event = { title: market.question, slug: market.slug, startDate: market.startDate, endDate: market.endDate };
        markets = [market];
      }
    }

    // Aggregate volumes
    const totalVolume = markets.reduce((s, m) => s + parseVol(m.volume), 0) || parseVol(event.volume);
    const totalVolume24h = markets.reduce((s, m) => s + parseVol(m.volume24hr), 0) || parseVol(event.volume24hr);
    const totalLiquidity = markets.reduce((s, m) => s + parseVol(m.liquidity), 0) || parseVol(event.liquidity);

    return NextResponse.json({
      type: parsed.type,
      title: event.title || markets[0]?.question || '—',
      slug: event.slug || parsed.slug,
      startDate: event.startDate || markets[0]?.startDate || null,
      endDate: event.endDate || markets[0]?.endDate || null,
      volume: totalVolume,
      volume24h: totalVolume24h,
      liquidity: totalLiquidity,
      markets: markets.map((m: any) => ({
        question: m.question,
        conditionId: m.conditionId,
        volume: parseVol(m.volume),
        volume24h: parseVol(m.volume24hr),
        liquidity: parseVol(m.liquidity),
        outcomePrices: m.outcomePrices,
        active: m.active,
        closed: m.closed,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
