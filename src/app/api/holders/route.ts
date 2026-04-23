import { NextRequest, NextResponse } from 'next/server';

async function fetchOnChainUsdc(wallet: string): Promise<number> {
  const USDC_NATIVE = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
  const padded = wallet.replace('0x', '').toLowerCase().padStart(64, '0');
  const callData = '0x70a08231' + padded;
  try {
    const r = await fetch('https://polygon.drpc.org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: USDC_NATIVE, data: callData }, 'latest'],
        id: 1,
      }),
    });
    const j = await r.json();
    if (!j.result || j.result === '0x') return 0;
    return parseInt(j.result, 16) / 1e6;
  } catch {
    return 0;
  }
}

async function fetchWalletValue(wallet: string): Promise<number> {
  try {
    const r = await fetch(`https://data-api.polymarket.com/value?user=${wallet}`, {
      next: { revalidate: 120 },
    });
    if (!r.ok) return 0;
    const d = await r.json();
    const v = Array.isArray(d) ? d[0] : d;
    return typeof v?.value === 'number' ? v.value : 0;
  } catch {
    return 0;
  }
}

async function fetchEarliestTradeTs(wallet: string, conditionId: string): Promise<number | null> {
  try {
    const r = await fetch(
      `https://data-api.polymarket.com/trades?user=${wallet}&market=${conditionId}&limit=100`,
      { next: { revalidate: 120 } }
    );
    if (!r.ok) return null;
    const trades = await r.json();
    if (!Array.isArray(trades) || trades.length === 0) return null;
    let min = Infinity;
    for (const t of trades) {
      if (typeof t.timestamp === 'number' && t.timestamp < min) min = t.timestamp;
    }
    return min === Infinity ? null : min;
  } catch {
    return null;
  }
}

function computeLiquidationRisk(
  positionPct: number,
  cashPct: number,
  holdDays: number
): 'red' | 'yellow' | 'green' {
  const posConc = Math.min(positionPct / 100, 1);
  const cashRatio = Math.min(cashPct / 100, 1);
  // recency penalty: 1.0 if held <1 day, decays to 0 after 14+ days
  const recency = holdDays <= 0 ? 1 : Math.min(1, 14 / Math.max(holdDays, 0.5));
  // score: higher = more likely to liquidate for cash
  // - high concentration → over-exposed, may want to reduce
  // - low cash ratio → needs cash for new positions
  // - short hold → momentum trader, quicker to exit
  const score = posConc * 0.4 + (1 - cashRatio) * 0.3 + recency * 0.3;
  if (score > 0.65) return 'red';
  if (score > 0.38) return 'yellow';
  return 'green';
}

export async function GET(req: NextRequest) {
  const conditionId = req.nextUrl.searchParams.get('conditionId') || '';
  const yesPriceStr = req.nextUrl.searchParams.get('yesPrice') || '0.5';
  if (!conditionId) {
    return NextResponse.json({ error: 'conditionId required' }, { status: 400 });
  }

  const yesPrice = Math.max(0.001, Math.min(0.999, parseFloat(yesPriceStr) || 0.5));
  const noPrice = 1 - yesPrice;

  try {
    // Fetch top 10 holders for each token outcome
    const r = await fetch(
      `https://data-api.polymarket.com/holders?market=${conditionId}&limit=10`,
      { next: { revalidate: 120 } }
    );
    if (!r.ok) {
      return NextResponse.json({ error: `holders API returned ${r.status}` }, { status: 502 });
    }
    const data = await r.json();
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'unexpected holders response' }, { status: 502 });
    }

    // Split into YES (outcomeIndex=0) and NO (outcomeIndex=1) holders
    const yesHolders: any[] = [];
    const noHolders: any[] = [];
    for (const tokenData of data) {
      for (const h of tokenData.holders || []) {
        if (h.outcomeIndex === 0) yesHolders.push(h);
        else noHolders.push(h);
      }
    }

    // Collect unique wallets across both sides
    const uniqueWallets = [
      ...new Set([...yesHolders, ...noHolders].map((h: any) => h.proxyWallet as string)),
    ];

    // Fetch portfolio + trade history for all wallets in parallel
    const portfolioResults = await Promise.all(
      uniqueWallets.map(async (wallet) => {
        const [positionsValue, cashBalance, earliestTs] = await Promise.all([
          fetchWalletValue(wallet),
          fetchOnChainUsdc(wallet),
          fetchEarliestTradeTs(wallet, conditionId),
        ]);
        const totalAssets = positionsValue + cashBalance;
        const holdDays =
          earliestTs != null
            ? Math.floor((Date.now() / 1000 - earliestTs) / 86400)
            : 0;
        return { wallet, positionsValue, cashBalance, totalAssets, holdDays };
      })
    );
    const portfolioMap = Object.fromEntries(portfolioResults.map((p) => [p.wallet, p]));

    function enrichHolder(h: any, tokenPrice: number) {
      const p = portfolioMap[h.proxyWallet];
      const positionValue = h.amount * tokenPrice;
      const totalAssets = p?.totalAssets ?? 0;
      const cashBalance = p?.cashBalance ?? 0;
      const holdDays = p?.holdDays ?? 0;
      const positionPct = totalAssets > 0 ? (positionValue / totalAssets) * 100 : 0;
      const cashPct = totalAssets > 0 ? (cashBalance / totalAssets) * 100 : 0;
      const liquidationRisk = computeLiquidationRisk(positionPct, cashPct, holdDays);
      // Use display name if it looks real (not the default proxy-wallet based name)
      const displayName =
        h.name && !h.name.startsWith('0x') && h.name !== h.pseudonym
          ? h.name
          : h.pseudonym;
      return {
        proxyWallet: h.proxyWallet,
        name: displayName,
        amount: h.amount,
        positionValue,
        positionPct,
        cashPct,
        holdDays,
        liquidationRisk,
      };
    }

    return NextResponse.json({
      yes: yesHolders.map((h) => enrichHolder(h, yesPrice)),
      no: noHolders.map((h) => enrichHolder(h, noPrice)),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
