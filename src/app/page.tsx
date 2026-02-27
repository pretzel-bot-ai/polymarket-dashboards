'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Position {
  title: string;
  outcome: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  realizedPnl: number;
  redeemable: boolean;
  category: string;
  eventSlug: string;
  slug: string;
}

interface CategoryPnl {
  category: string;
  unrealized: number;
  realized: number;
  total: number;
}

interface MarketPnl {
  title: string;
  pnl: number;
}

interface RewardsMarket {
  question: string;
  event_slug: string;
  ratePerDay: number;
  earningPct: number;
  competitiveness: number;
  category: string;
}

interface Activity {
  timestamp: number;
  type: 'TRADE' | 'REDEEM' | 'YIELD' | 'REWARD';
  side: string | null;
  title: string | null;
  outcome: string | null;
  size: number;
  usdcSize: number;
  price: number;
  slug: string | null;
  eventSlug: string | null;
  transactionHash: string | null;
}

interface SuggestedMarket {
  title: string;
  slug: string;
  eventSlug: string;
  category: string;
  volume: number;
  yesPrice: number;
  score: number;
  reason: string;
}

interface DashboardData {
  wallet: string;
  updatedAt: string;
  portfolio: {
    totalValue: number;
    positionsValue: number;
    cashBalance: number;
    onChainUsdc: number;
    unrealizedPnl: number;
    realizedPnl: number;
    totalPnl: number;
    openCount: number;
    totalPositions: number;
  };
  pnl: {
    day:   { sells: number; redeems: number; misc: number; total: number };
    week:  { sells: number; redeems: number; misc: number; total: number };
    month: { sells: number; redeems: number; misc: number; total: number };
    all:   { sells: number; redeems: number; misc: number; total: number };
    dayMarkets: MarketPnl[];
    weekMarkets: MarketPnl[];
    monthMarkets: MarketPnl[];
  };
  categoryPnl: CategoryPnl[];
  positions: Position[];
  rewards: {
    active: RewardsMarket[];
    top: RewardsMarket[];
  };
  suggestions: SuggestedMarket[];
  activity: Activity[];
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt$(n: number, decimals = 0): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(decimals)}`;
}

function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function fmtSize(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toFixed(0);
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function pnlColor(n: number): string {
  if (n > 0) return 'text-green-400';
  if (n < 0) return 'text-red-400';
  return 'text-gray-400';
}

function timeAgo(isoOrTs: string | number): string {
  const ms = typeof isoOrTs === 'number' ? isoOrTs * 1000 : new Date(isoOrTs).getTime();
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en-GB', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Panel({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`border border-amber-700 ${className}`}>
      <div className="bg-amber-900/30 border-b border-amber-700 px-3 py-1">
        <span className="text-amber-400 text-xs font-bold tracking-widest">{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function StatCard({ label, value, sub, valueClass = '' }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="border border-amber-800 p-3 flex flex-col gap-1">
      <div className="text-amber-500 text-xs tracking-widest">{label}</div>
      <div className={`text-xl font-bold font-mono ${valueClass || 'text-white'}`}>{value}</div>
      {sub && <div className="text-gray-500 text-xs">{sub}</div>}
    </div>
  );
}

function BarChart({ data, maxAbs }: { data: CategoryPnl[]; maxAbs: number }) {
  return (
    <div className="space-y-2">
      {data.map((c) => {
        const barPct = maxAbs > 0 ? Math.abs(c.total) / maxAbs * 100 : 0;
        const isPos = c.total >= 0;
        return (
          <div key={c.category} className="flex items-center gap-2">
            <div className="text-amber-300 text-xs w-28 shrink-0">{c.category}</div>
            <div className="flex-1 relative h-4 bg-gray-900 border border-gray-800">
              <div
                className={`h-full ${isPos ? 'bg-green-700' : 'bg-red-800'}`}
                style={{ width: `${barPct}%` }}
              />
            </div>
            <div className={`text-xs font-mono w-20 text-right shrink-0 ${pnlColor(c.total)}`}>
              {fmt$(c.total)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type SortKey = 'value' | 'pnl' | 'pct' | 'size';
type SortDir = 'asc' | 'desc';

function PositionsTable({ positions }: { positions: Position[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showAll, setShowAll] = useState(false);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = [...positions].sort((a, b) => {
    const map: Record<SortKey, (p: Position) => number> = {
      value: p => p.currentValue,
      pnl: p => p.cashPnl,
      pct: p => p.percentPnl,
      size: p => p.size,
    };
    const va = map[sortKey](a), vb = map[sortKey](b);
    return sortDir === 'desc' ? vb - va : va - vb;
  });

  const display = showAll ? sorted : sorted.slice(0, 15);

  function SortHdr({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => handleSort(k)}
        className={`text-left ${active ? 'text-amber-300' : 'text-amber-600'} hover:text-amber-300`}
      >
        {label}{active ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''}
      </button>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-x-3 text-xs text-amber-600 tracking-widest pb-1 border-b border-amber-900 mb-1">
        <div>MARKET</div>
        <div>SIDE</div>
        <SortHdr k="size" label="SIZE" />
        <SortHdr k="value" label="VALUE" />
        <div>AVG/CUR</div>
        <SortHdr k="pnl" label="CASH P&L" />
        <SortHdr k="pct" label="%" />
      </div>
      {display.map((p, i) => (
        <div
          key={i}
          className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-x-3 text-xs py-0.5 border-b border-gray-900 hover:bg-amber-900/10 transition-colors ${p.redeemable ? 'opacity-50' : ''}`}
        >
          <div className="text-gray-200 truncate" title={p.title}>
            {truncate(p.title, 50)}
            <span className="ml-1 text-gray-600">[{p.category.split(' ')[0]}]</span>
          </div>
          <div className={p.outcome === 'Yes' ? 'text-green-400' : 'text-blue-400'}>
            {p.outcome.toUpperCase()}
          </div>
          <div className="text-gray-300 font-mono">{fmtSize(p.size)}</div>
          <div className="text-gray-300 font-mono">{fmt$(p.currentValue)}</div>
          <div className="text-gray-500 font-mono">
            ${p.avgPrice.toFixed(3)} / ${p.curPrice.toFixed(3)}
          </div>
          <div className={`font-mono ${pnlColor(p.cashPnl)}`}>{fmt$(p.cashPnl)}</div>
          <div className={`font-mono ${pnlColor(p.percentPnl)}`}>{fmtPct(p.percentPnl)}</div>
        </div>
      ))}
      {sorted.length > 15 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-2 text-xs text-amber-700 hover:text-amber-400"
        >
          {showAll ? '▲ SHOW LESS' : `▼ SHOW ALL ${sorted.length} POSITIONS`}
        </button>
      )}
    </div>
  );
}

function RewardsPanel({ markets, isActive }: { markets: RewardsMarket[]; isActive: boolean }) {
  const [catFilter, setCatFilter] = useState<string>('ALL');

  const categories = ['ALL', ...Array.from(new Set(markets.map(m => m.category))).sort()];
  const filtered = catFilter === 'ALL' ? markets : markets.filter(m => m.category === catFilter);

  return (
    <div>
      {/* Category filter bar */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={`text-xs px-2 py-0.5 border ${
              catFilter === cat
                ? 'border-amber-500 text-amber-300 bg-amber-900/30'
                : 'border-gray-800 text-gray-600 hover:border-amber-800 hover:text-amber-600'
            }`}
          >
            {cat}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-600">{filtered.length} markets</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-gray-600 text-xs">No markets in this category.</div>
      ) : (
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-x-4 text-xs">
          <div className="text-amber-600 tracking-widest pb-1 border-b border-amber-900">MARKET</div>
          <div className="text-amber-600 tracking-widest pb-1 border-b border-amber-900">CATEGORY</div>
          <div className="text-amber-600 tracking-widest pb-1 border-b border-amber-900">RATE/DAY</div>
          <div className="text-amber-600 tracking-widest pb-1 border-b border-amber-900">
            {isActive ? 'EARNING %' : 'COMPETIT.'}
          </div>
          <div className="text-amber-600 tracking-widest pb-1 border-b border-amber-900">
            {isActive ? 'ACTIVE' : 'STATUS'}
          </div>
          {filtered.map((m, i) => (
            <>
              <div key={`t${i}`} className="text-gray-300 py-0.5 border-b border-gray-900 truncate" title={m.question}>
                <a
                  href={`https://polymarket.com/event/${m.event_slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-amber-300"
                >
                  {truncate(m.question, 50)}
                </a>
              </div>
              <div key={`c${i}`} className="text-gray-500 py-0.5 border-b border-gray-900 truncate">
                {m.category}
              </div>
              <div key={`r${i}`} className="text-green-400 py-0.5 border-b border-gray-900 font-mono">
                ${m.ratePerDay.toFixed(2)}/day
              </div>
              <div key={`e${i}`} className={`py-0.5 border-b border-gray-900 font-mono ${m.earningPct > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                {isActive ? `${m.earningPct.toFixed(1)}%` : `${m.competitiveness.toFixed(0)}x`}
              </div>
              <div key={`s${i}`} className="py-0.5 border-b border-gray-900">
                {isActive
                  ? <span className="text-green-400">● EARNING</span>
                  : <span className="text-amber-700">◌ AVAILABLE</span>
                }
              </div>
            </>
          ))}
        </div>
      )}
    </div>
  );
}

type PnlTab = '1d' | '7d' | '30d' | 'all';

function PnlStatsPanel({ portfolio, pnl }: {
  portfolio: DashboardData['portfolio'];
  pnl: DashboardData['pnl'];
}) {
  const [tab, setTab] = useState<PnlTab>('all');

  const tabs: { key: PnlTab; label: string }[] = [
    { key: '1d', label: '1D' },
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
    { key: 'all', label: 'ALL' },
  ];

  const period     = tab === '1d' ? pnl.day : tab === '7d' ? pnl.week : tab === '30d' ? pnl.month : pnl.all;
  const unrealized = portfolio.unrealizedPnl;
  const net        = period.total + unrealized;
  const realizedSub = tab === '1d' ? 'last 24h' : tab === '7d' ? 'last 7d' : tab === '30d' ? 'last 30d' : 'all-time';

  return (
    <div className="md:col-span-3 border border-amber-800">
      <div className="bg-amber-900/20 border-b border-amber-800 px-3 py-1 flex items-center gap-2">
        <span className="text-amber-400 text-xs font-bold tracking-widest">P&L</span>
        <span className="text-gray-700 text-xs">│</span>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`text-xs px-2 py-0.5 border ${
              tab === key
                ? 'border-amber-500 text-amber-300 bg-amber-900/30'
                : 'border-gray-800 text-gray-600 hover:border-amber-800 hover:text-amber-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-3 grid grid-cols-6 gap-2">
        <div className="flex flex-col gap-1">
          <div className="text-amber-500 text-xs tracking-widest">SELLS</div>
          <div className={`text-lg font-bold font-mono ${pnlColor(period.sells)}`}>{fmt$(period.sells)}</div>
          <div className="text-gray-500 text-xs">{realizedSub}</div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-amber-500 text-xs tracking-widest">REDEEMS</div>
          <div className={`text-lg font-bold font-mono ${pnlColor(period.redeems)}`}>{fmt$(period.redeems)}</div>
          <div className="text-gray-500 text-xs">{realizedSub}</div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-amber-500 text-xs tracking-widest">YLD + RWD</div>
          <div className={`text-lg font-bold font-mono ${pnlColor(period.misc)}`}>{fmt$(period.misc)}</div>
          <div className="text-gray-500 text-xs">{realizedSub}</div>
        </div>
        <div className="flex flex-col gap-1 border-l border-amber-900 pl-2">
          <div className="text-amber-500 text-xs tracking-widest">REALIZED</div>
          <div className={`text-lg font-bold font-mono ${pnlColor(period.total)}`}>{fmt$(period.total)}</div>
          <div className="text-gray-500 text-xs">{realizedSub}</div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-amber-500 text-xs tracking-widest">UNREALIZED</div>
          <div className={`text-lg font-bold font-mono ${pnlColor(unrealized)}`}>{fmt$(unrealized)}</div>
          <div className="text-gray-500 text-xs">open positions</div>
        </div>
        <div className="flex flex-col gap-1 border-l border-amber-900 pl-2">
          <div className="text-amber-500 text-xs tracking-widest">NET</div>
          <div className={`text-lg font-bold font-mono ${pnlColor(net)}`}>{fmt$(net)}</div>
          <div className="text-gray-500 text-xs">realized + unrealized</div>
        </div>
      </div>
    </div>
  );
}

function PnlBreakdown({ markets, label }: { markets: MarketPnl[]; label: string }) {
  if (!markets.length) return <div className="text-gray-600 text-xs">No activity</div>;
  return (
    <div>
      <div className="text-amber-600 text-xs mb-1 tracking-widest">{label}</div>
      {markets.map((m, i) => (
        <div key={i} className="flex justify-between text-xs py-0.5 border-b border-gray-900">
          <div className="text-gray-400 truncate w-64" title={m.title}>{truncate(m.title, 42)}</div>
          <div className={`font-mono ml-2 ${pnlColor(m.pnl)}`}>{fmt$(m.pnl)}</div>
        </div>
      ))}
    </div>
  );
}

type ActivityFilter = 'ALL' | 'BUY' | 'SELL' | 'REDEEM' | 'YIELD' | 'REWARD';

function activityBadge(a: Activity): { label: string; cls: string } {
  if (a.type === 'TRADE') {
    const isBuy = a.side === 'BUY';
    return isBuy
      ? { label: 'BUY', cls: 'text-green-400 border-green-800' }
      : { label: 'SELL', cls: 'text-red-400 border-red-900' };
  }
  if (a.type === 'REDEEM') return { label: 'SETTLE', cls: 'text-amber-400 border-amber-800' };
  if (a.type === 'YIELD')  return { label: 'YIELD',  cls: 'text-cyan-400 border-cyan-900' };
  if (a.type === 'REWARD') return { label: 'REWARD', cls: 'text-purple-400 border-purple-900' };
  return { label: a.type, cls: 'text-gray-400 border-gray-700' };
}

function ActivityFeed({ activity }: { activity: Activity[] }) {
  const [filter, setFilter] = useState<ActivityFilter>('ALL');
  const [showAll, setShowAll] = useState(false);

  const filters: ActivityFilter[] = ['ALL', 'BUY', 'SELL', 'REDEEM', 'YIELD', 'REWARD'];

  const filtered = activity.filter(a => {
    if (filter === 'ALL') return true;
    if (filter === 'BUY')    return a.type === 'TRADE' && a.side === 'BUY';
    if (filter === 'SELL')   return a.type === 'TRADE' && a.side === 'SELL';
    if (filter === 'REDEEM') return a.type === 'REDEEM';
    if (filter === 'YIELD')  return a.type === 'YIELD';
    if (filter === 'REWARD') return a.type === 'REWARD';
    return true;
  });

  const display = showAll ? filtered : filtered.slice(0, 50);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setShowAll(false); }}
            className={`text-xs px-2 py-0.5 border ${
              filter === f
                ? 'border-amber-500 text-amber-300 bg-amber-900/30'
                : 'border-gray-800 text-gray-600 hover:border-amber-800 hover:text-amber-600'
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-600">{filtered.length} events</span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[80px_70px_2fr_1fr_1fr_80px] gap-x-3 text-xs text-amber-600 tracking-widest pb-1 border-b border-amber-900 mb-1">
        <div>TIME</div>
        <div>TYPE</div>
        <div>MARKET</div>
        <div>SIDE/OUTCOME</div>
        <div className="text-right">USDC</div>
        <div className="text-right">TX</div>
      </div>

      {/* Rows */}
      {display.length === 0 ? (
        <div className="text-gray-600 text-xs py-2">No events</div>
      ) : display.map((a, i) => {
        const badge = activityBadge(a);
        const marketTitle = a.title || (a.type === 'YIELD' ? 'USDC Yield' : a.type === 'REWARD' ? 'LP Reward' : '—');
        const sideLabel = a.type === 'TRADE'
          ? `${a.side} ${a.outcome || ''} @ $${a.price.toFixed(3)}`
          : a.type === 'REDEEM' ? 'Settlement' : '—';
        const polyUrl = a.eventSlug ? `https://polymarket.com/event/${a.eventSlug}` : null;
        const txUrl = a.transactionHash ? `https://polygonscan.com/tx/${a.transactionHash}` : null;

        return (
          <div
            key={i}
            className="grid grid-cols-[80px_70px_2fr_1fr_1fr_80px] gap-x-3 text-xs py-0.5 border-b border-gray-900 hover:bg-amber-900/10 transition-colors"
          >
            <div className="text-gray-600 font-mono" title={fmtDate(a.timestamp)}>
              {timeAgo(a.timestamp)}
            </div>
            <div>
              <span className={`border px-1 font-mono text-xs ${badge.cls}`}>{badge.label}</span>
            </div>
            <div className="text-gray-300 truncate">
              {polyUrl ? (
                <a href={polyUrl} target="_blank" rel="noopener noreferrer" className="hover:text-amber-300" title={marketTitle}>
                  {truncate(marketTitle, 48)}
                </a>
              ) : truncate(marketTitle, 48)}
            </div>
            <div className="text-gray-500 truncate font-mono">{sideLabel}</div>
            <div className={`text-right font-mono ${a.type === 'TRADE' && a.side === 'BUY' ? 'text-red-400' : 'text-green-400'}`}>
              {a.type === 'TRADE' && a.side === 'BUY' ? '-' : '+'}{fmt$(a.usdcSize, 2).replace(/^[+-]/, '')}
            </div>
            <div className="text-right">
              {txUrl ? (
                <a href={txUrl} target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-amber-400 font-mono">
                  ↗ TX
                </a>
              ) : '—'}
            </div>
          </div>
        );
      })}

      {filtered.length > 50 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-2 text-xs text-amber-700 hover:text-amber-400"
        >
          {showAll ? '▲ SHOW LESS' : `▼ SHOW ALL ${filtered.length} EVENTS`}
        </button>
      )}
    </div>
  );
}

function OrderBook({ book, question }: { book: any; question?: string }) {
  if (!book) return <div className="text-gray-700 text-xs">Order book unavailable</div>;
  const { bids, asks, spread, midpoint } = book;
  const maxSize = Math.max(...bids.map((b: any) => b.size), ...asks.map((a: any) => a.size), 1);

  return (
    <div>
      {question && <div className="text-gray-400 text-xs mb-1 truncate">{truncate(question, 60)}</div>}
      <div className="grid grid-cols-2 gap-x-4 text-xs font-mono">
        {/* Header */}
        <div className="grid grid-cols-[1fr_1fr] gap-x-2 text-amber-700 tracking-widest pb-0.5 border-b border-green-900">
          <div>BID (BUY YES)</div><div className="text-right">SIZE</div>
        </div>
        <div className="grid grid-cols-[1fr_1fr] gap-x-2 text-amber-700 tracking-widest pb-0.5 border-b border-red-900">
          <div>ASK (SELL YES)</div><div className="text-right">SIZE</div>
        </div>
        {/* Rows */}
        {Array.from({ length: Math.max(bids.length, asks.length) }).map((_, i) => {
          const bid = bids[i];
          const ask = asks[i];
          const bidPct = bid ? bid.size / maxSize * 100 : 0;
          const askPct = ask ? ask.size / maxSize * 100 : 0;
          return (
            <>
              <div key={`b${i}`} className="relative grid grid-cols-[1fr_1fr] gap-x-2 py-px">
                <div
                  className="absolute inset-y-0 right-0 bg-green-900/20"
                  style={{ width: `${bidPct}%` }}
                />
                <div className="relative text-green-400">{bid ? (bid.price * 100).toFixed(1) + '¢' : ''}</div>
                <div className="relative text-gray-500 text-right">{bid ? fmtSize(bid.size) : ''}</div>
              </div>
              <div key={`a${i}`} className="relative grid grid-cols-[1fr_1fr] gap-x-2 py-px">
                <div
                  className="absolute inset-y-0 left-0 bg-red-900/20"
                  style={{ width: `${askPct}%` }}
                />
                <div className="relative text-red-400">{ask ? (ask.price * 100).toFixed(1) + '¢' : ''}</div>
                <div className="relative text-gray-500 text-right">{ask ? fmtSize(ask.size) : ''}</div>
              </div>
            </>
          );
        })}
      </div>
      <div className="flex gap-4 mt-1.5 text-xs font-mono border-t border-gray-900 pt-1">
        <span className="text-amber-600">MID</span>
        <span className="text-gray-300">{midpoint != null ? (midpoint * 100).toFixed(1) + '¢' : '—'}</span>
        <span className="text-amber-600">SPREAD</span>
        <span className={spread != null && spread < 0.02 ? 'text-green-400' : 'text-yellow-500'}>
          {spread != null ? (spread * 100).toFixed(1) + '¢' : '—'}
        </span>
      </div>
    </div>
  );
}

function RewardsBadge({ rewards }: { rewards: any }) {
  if (!rewards?.enabled) return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-700">○ NO LP REWARDS</span>
    </div>
  );
  return (
    <div className="border border-amber-900/50 bg-amber-900/10 px-3 py-2 text-xs space-y-1">
      <div className="text-amber-400 font-bold tracking-widest">● LP REWARDS ACTIVE  (epoch {rewards.epoch})</div>
      <div className="flex gap-6 text-gray-300 font-mono">
        {rewards.minSize > 0 && (
          <div><span className="text-amber-700">MIN ORDER </span>${rewards.minSize.toFixed(0)}</div>
        )}
        {rewards.maxSpread > 0 && (
          <div><span className="text-amber-700">MAX SPREAD </span>{(rewards.maxSpread * 100).toFixed(1)}% from mid</div>
        )}
      </div>
    </div>
  );
}

function MarketLookupPanel() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState(0);

  async function lookup() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedMarket(0);
    try {
      const res = await fetch(`/api/market?url=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function fmtDateStr(s: string | null): string {
    if (!s) return '—';
    try {
      return new Date(s).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return s; }
  }

  function getYesPrice(outcomePrices: any): number {
    try {
      const prices = typeof outcomePrices === 'string' ? JSON.parse(outcomePrices) : (outcomePrices || []);
      return parseFloat(prices[0]) || 0.5;
    } catch { return 0.5; }
  }

  return (
    <div>
      {/* URL input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && lookup()}
          placeholder="https://polymarket.com/event/…"
          className="flex-1 bg-black border border-amber-900 text-gray-300 text-xs px-2 py-1.5 font-mono placeholder-gray-700 focus:outline-none focus:border-amber-600"
        />
        <button
          onClick={lookup}
          disabled={loading || !url.trim()}
          className="text-xs px-3 py-1.5 border border-amber-700 text-amber-400 hover:bg-amber-900/30 disabled:opacity-40 transition-colors"
        >
          {loading ? '…' : 'LOOK UP'}
        </button>
      </div>

      {error && <div className="text-red-400 text-xs mb-2">{error}</div>}

      {result && (
        <div className="space-y-4">
          {/* Title */}
          <div className="text-gray-200 text-sm font-bold leading-tight">{result.title}</div>

          {/* Top stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="border border-amber-900 p-2">
              <div className="text-amber-600 text-xs tracking-widest mb-1">CREATED</div>
              <div className="text-white text-sm font-mono">{fmtDateStr(result.startDate)}</div>
            </div>
            <div className="border border-amber-900 p-2">
              <div className="text-amber-600 text-xs tracking-widest mb-1">ENDS</div>
              <div className="text-white text-sm font-mono">{fmtDateStr(result.endDate)}</div>
            </div>
            <div className="border border-amber-900 p-2">
              <div className="text-amber-600 text-xs tracking-widest mb-1">24H VOLUME</div>
              <div className="text-white text-sm font-mono font-bold">${fmtSize(result.volume24h)}</div>
            </div>
            <div className="border border-amber-900 p-2">
              <div className="text-amber-600 text-xs tracking-widest mb-1">ALL-TIME VOL</div>
              <div className="text-white text-sm font-mono font-bold">${fmtSize(result.volume)}</div>
            </div>
          </div>

          {result.markets.length === 1 ? (
            /* ── Single market ── */
            <div className="space-y-3">
              {/* Price + status row */}
              <div className="flex gap-6 text-xs font-mono items-center">
                <div>
                  <span className="text-amber-600 mr-1">YES</span>
                  <span className="text-green-400">{(getYesPrice(result.markets[0].outcomePrices) * 100).toFixed(1)}¢</span>
                </div>
                <div>
                  <span className="text-amber-600 mr-1">NO</span>
                  <span className="text-red-400">{((1 - getYesPrice(result.markets[0].outcomePrices)) * 100).toFixed(1)}¢</span>
                </div>
                <div>
                  <span className="text-amber-600 mr-1">LIQUIDITY</span>
                  <span className="text-gray-300">${fmtSize(result.liquidity)}</span>
                </div>
                <span className={result.markets[0].closed ? 'text-gray-600' : 'text-green-500'}>
                  {result.markets[0].closed ? '● CLOSED' : '● ACTIVE'}
                </span>
              </div>

              {/* Order book */}
              <div>
                <div className="text-amber-600 text-xs tracking-widest mb-2">ORDER BOOK (YES TOKEN)</div>
                <OrderBook book={result.markets[0].orderBook} />
              </div>

              {/* Rewards */}
              <div>
                <div className="text-amber-600 text-xs tracking-widest mb-2">LP REWARDS</div>
                <RewardsBadge rewards={result.markets[0].rewards} />
              </div>
            </div>
          ) : (
            /* ── Multi-market event ── */
            <div className="space-y-3">
              {/* Market selector tabs */}
              <div className="flex gap-1 flex-wrap">
                {result.markets.map((m: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => setSelectedMarket(i)}
                    className={`text-xs px-2 py-0.5 border ${
                      selectedMarket === i
                        ? 'border-amber-500 text-amber-300 bg-amber-900/30'
                        : 'border-gray-800 text-gray-600 hover:border-amber-800 hover:text-amber-600'
                    }`}
                    title={m.question}
                  >
                    {truncate(m.question, 28)}
                  </button>
                ))}
              </div>

              {/* Selected market detail */}
              {(() => {
                const m = result.markets[selectedMarket];
                if (!m) return null;
                const yp = getYesPrice(m.outcomePrices);
                return (
                  <div className="space-y-3">
                    <div className="flex gap-6 text-xs font-mono items-center">
                      <div><span className="text-amber-600 mr-1">YES</span><span className="text-green-400">{(yp * 100).toFixed(1)}¢</span></div>
                      <div><span className="text-amber-600 mr-1">NO</span><span className="text-red-400">{((1 - yp) * 100).toFixed(1)}¢</span></div>
                      <div><span className="text-amber-600 mr-1">24H VOL</span><span className="text-gray-300">${fmtSize(m.volume24h)}</span></div>
                      <div><span className="text-amber-600 mr-1">LIQUIDITY</span><span className="text-gray-300">${fmtSize(m.liquidity)}</span></div>
                      <span className={m.closed ? 'text-gray-600' : 'text-green-500'}>
                        {m.closed ? '● CLOSED' : '● ACTIVE'}
                      </span>
                    </div>
                    <div>
                      <div className="text-amber-600 text-xs tracking-widest mb-2">ORDER BOOK (YES TOKEN)</div>
                      <OrderBook book={m.orderBook} />
                    </div>
                    <div>
                      <div className="text-amber-600 text-xs tracking-widest mb-2">LP REWARDS</div>
                      <RewardsBadge rewards={m.rewards} />
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestedMarketsPanel({ suggestions }: { suggestions: SuggestedMarket[] }) {
  const [showAll, setShowAll] = useState(false);
  const display = showAll ? suggestions : suggestions.slice(0, 10);

  if (suggestions.length === 0) {
    return <div className="text-gray-600 text-xs">No suggestions available.</div>;
  }

  return (
    <div>
      <div className="space-y-2">
        {display.map((m, i) => {
          const href = m.eventSlug
            ? `https://polymarket.com/event/${m.eventSlug}`
            : `https://polymarket.com/market/${m.slug}`;
          return (
            <div key={i} className="border-b border-gray-900 pb-2 hover:bg-amber-900/5 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-0.5">
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-200 text-xs hover:text-amber-300 leading-tight flex-1"
                  title={m.title}
                >
                  {truncate(m.title, 52)}
                </a>
                <div className="flex flex-col items-end shrink-0 gap-0.5">
                  <span className="text-xs font-mono text-green-400">
                    YES {(m.yesPrice * 100).toFixed(0)}¢
                  </span>
                  <span className="text-xs font-mono text-gray-700">
                    {(m.score * 100).toFixed(0)}% match
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs flex-wrap">
                <span className="text-amber-700">{m.category}</span>
                <span className="text-gray-800">·</span>
                <span className="text-gray-600">${fmtSize(m.volume)} vol</span>
                {m.reason && (
                  <>
                    <span className="text-gray-800">·</span>
                    <span className="text-gray-500 truncate">{m.reason}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {suggestions.length > 10 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-2 text-xs text-amber-700 hover:text-amber-400"
        >
          {showAll ? '▲ SHOW LESS' : `▼ SHOW ALL ${suggestions.length}`}
        </button>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'day' | 'week' | 'month'>('week');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // auto-refresh every 60s
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-mono">
        <div className="text-amber-400 text-sm animate-pulse">
          ■ POLYMARKET TERMINAL — LOADING DATA...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-mono">
        <div className="text-red-400 text-sm">
          ERROR: {error || 'No data'}
          <button onClick={load} className="ml-4 text-amber-400 underline">RETRY</button>
        </div>
      </div>
    );
  }

  const { portfolio, pnl, categoryPnl, positions, rewards, suggestions, activity } = data;
  const maxCatAbs = Math.max(...categoryPnl.map(c => Math.abs(c.total)), 1);

  // LP rewards display
  const rewardsDisplay = rewards.active.length > 0 ? rewards.active : rewards.top;
  const rewardsTitle = rewards.active.length > 0
    ? `ACTIVE LP POSITIONS (${rewards.active.length})`
    : 'TOP LP REWARD MARKETS';

  const tabPnl = { day: pnl.day.total, week: pnl.week.total, month: pnl.month.total }[activeTab];
  const tabMarkets = { day: pnl.dayMarkets, week: pnl.weekMarkets, month: pnl.monthMarkets }[activeTab];

  return (
    <div className="min-h-screen bg-black font-mono text-gray-200 p-2 md:p-4">
      {/* Header */}
      <div className="border border-amber-600 mb-3">
        <div className="bg-amber-900/40 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span className="text-amber-400 font-bold tracking-widest text-sm">■ POLYMARKET</span>
            <span className="text-gray-500 text-xs">│</span>
            <a
              href="https://polymarket.com/@woodlawncap"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white text-xs hover:text-amber-300"
            >
              woodlawncap
            </a>
            <span className="text-gray-500 text-xs">│</span>
            <span className="text-gray-500 text-xs hidden md:inline">
              {data.wallet.slice(0, 6)}…{data.wallet.slice(-4)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="text-green-500">● LIVE</span>
            <span>Updated {timeAgo(data.updatedAt)}</span>
            <button onClick={load} className="text-amber-700 hover:text-amber-400">↻ REFRESH</button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
        <StatCard
          label="PORTFOLIO VALUE"
          value={fmt$(portfolio.totalValue)}
          sub={`positions ${fmt$(portfolio.positionsValue)} + cash ${fmt$(portfolio.onChainUsdc, 2)}`}
        />
        <PnlStatsPanel portfolio={portfolio} pnl={pnl} />
      </div>

      {/* Middle Row: PnL by Period + Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {/* PnL Overview */}
        <Panel title="REALIZED P&L (COST-BASIS — SELLS + REDEEMS + REWARDS)">
          <div className="flex gap-2 mb-3">
            {(['day', 'week', 'month'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-xs px-2 py-0.5 border ${
                  activeTab === tab
                    ? 'border-amber-500 text-amber-300 bg-amber-900/30'
                    : 'border-gray-800 text-gray-600 hover:border-amber-800 hover:text-amber-600'
                }`}
              >
                {tab === 'day' ? '1D' : tab === 'week' ? '7D' : '30D'}
              </button>
            ))}
            <span className={`ml-2 text-lg font-bold ${pnlColor(tabPnl)}`}>{fmt$(tabPnl)}</span>
          </div>
          <PnlBreakdown
            markets={tabMarkets}
            label={`TOP MOVERS — ${activeTab === 'day' ? 'LAST 24H' : activeTab === 'week' ? 'LAST 7 DAYS' : 'LAST 30 DAYS'}`}
          />
          <div className="mt-3 pt-2 border-t border-gray-900 grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-amber-600">1D</div>
              <div className={`font-mono ${pnlColor(pnl.day.total)}`}>{fmt$(pnl.day.total)}</div>
            </div>
            <div>
              <div className="text-amber-600">7D</div>
              <div className={`font-mono ${pnlColor(pnl.week.total)}`}>{fmt$(pnl.week.total)}</div>
            </div>
            <div>
              <div className="text-amber-600">30D</div>
              <div className={`font-mono ${pnlColor(pnl.month.total)}`}>{fmt$(pnl.month.total)}</div>
            </div>
          </div>
        </Panel>

        {/* Category PnL */}
        <Panel title="CATEGORY P&L (UNREALIZED + REALIZED)">
          <BarChart data={categoryPnl} maxAbs={maxCatAbs} />
        </Panel>
      </div>

      {/* LP Rewards */}
      <Panel title={rewardsTitle} className="mb-3">
        {rewardsDisplay.length === 0
          ? <div className="text-gray-600 text-xs">No LP rewards data available.</div>
          : <RewardsPanel markets={rewardsDisplay} isActive={rewards.active.length > 0} />
        }
      </Panel>

      {/* Positions Table */}
      <Panel title={`OPEN POSITIONS (${portfolio.openCount} active / ${portfolio.totalPositions} total)`} className="mb-3">
        <PositionsTable positions={positions} />
      </Panel>

      {/* Market Lookup */}
      <Panel title="MARKET LOOKUP" className="mb-3">
        <MarketLookupPanel />
      </Panel>

      {/* Activity Feed + Suggested Markets */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3 mb-3">
        <Panel title={`ACCOUNT ACTIVITY (${data.activity.length} events)`}>
          <ActivityFeed activity={data.activity} />
        </Panel>
        <Panel title={`SUGGESTED MARKETS (${suggestions.length})`}>
          <SuggestedMarketsPanel suggestions={suggestions} />
        </Panel>
      </div>

      {/* Footer */}
      <div className="mt-3 text-center text-gray-800 text-xs">
        POLYMARKET DASHBOARD  ·  DATA: data-api.polymarket.com  ·  AUTO-REFRESH: 60s
      </div>
    </div>
  );
}
