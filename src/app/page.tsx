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
}

interface DashboardData {
  wallet: string;
  updatedAt: string;
  portfolio: {
    totalValue: number;
    positionsValue: number;
    cashBalance: number;
    unrealizedPnl: number;
    realizedPnl: number;
    totalPnl: number;
    openCount: number;
    totalPositions: number;
  };
  pnl: {
    day: number;
    week: number;
    month: number;
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

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
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

  const { portfolio, pnl, categoryPnl, positions, rewards } = data;
  const maxCatAbs = Math.max(...categoryPnl.map(c => Math.abs(c.total)), 1);

  // LP rewards display
  const rewardsDisplay = rewards.active.length > 0 ? rewards.active : rewards.top;
  const rewardsTitle = rewards.active.length > 0
    ? `ACTIVE LP POSITIONS (${rewards.active.length})`
    : 'TOP LP REWARD MARKETS';

  const tabPnl = { day: pnl.day, week: pnl.week, month: pnl.month }[activeTab];
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <StatCard
          label="PORTFOLIO VALUE"
          value={fmt$(portfolio.totalValue)}
          sub={`positions ${fmt$(portfolio.positionsValue)} + cash ${fmt$(portfolio.cashBalance)}`}
        />
        <StatCard
          label="TOTAL P&L (UNREAL.)"
          value={fmt$(portfolio.unrealizedPnl)}
          sub="unrealized across all positions"
          valueClass={pnlColor(portfolio.unrealizedPnl)}
        />
        <StatCard
          label="TOTAL REALIZED P&L"
          value={fmt$(portfolio.realizedPnl)}
          sub="lifetime realized"
          valueClass={pnlColor(portfolio.realizedPnl)}
        />
        <StatCard
          label="COMBINED P&L"
          value={fmt$(portfolio.totalPnl)}
          sub="unrealized + realized"
          valueClass={pnlColor(portfolio.totalPnl)}
        />
      </div>

      {/* Middle Row: PnL by Period + Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {/* PnL Overview */}
        <Panel title="TRADING P&L — NET CASH FLOW">
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
              <div className={`font-mono ${pnlColor(pnl.day)}`}>{fmt$(pnl.day)}</div>
            </div>
            <div>
              <div className="text-amber-600">7D</div>
              <div className={`font-mono ${pnlColor(pnl.week)}`}>{fmt$(pnl.week)}</div>
            </div>
            <div>
              <div className="text-amber-600">30D</div>
              <div className={`font-mono ${pnlColor(pnl.month)}`}>{fmt$(pnl.month)}</div>
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
        {rewardsDisplay.length === 0 ? (
          <div className="text-gray-600 text-xs">No LP rewards data available.</div>
        ) : (
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-x-4 text-xs">
            <div className="text-amber-600 tracking-widest pb-1 border-b border-amber-900">MARKET</div>
            <div className="text-amber-600 tracking-widest pb-1 border-b border-amber-900">RATE/DAY</div>
            <div className="text-amber-600 tracking-widest pb-1 border-b border-amber-900">
              {rewards.active.length > 0 ? 'EARNING %' : 'COMPETIT.'}
            </div>
            <div className="text-amber-600 tracking-widest pb-1 border-b border-amber-900">
              {rewards.active.length > 0 ? 'ACTIVE' : 'STATUS'}
            </div>
            {rewardsDisplay.map((m, i) => (
              <>
                <div key={`t${i}`} className="text-gray-300 py-0.5 border-b border-gray-900 truncate" title={m.question}>
                  <a
                    href={`https://polymarket.com/event/${m.event_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-amber-300"
                  >
                    {truncate(m.question, 55)}
                  </a>
                </div>
                <div key={`r${i}`} className="text-green-400 py-0.5 border-b border-gray-900 font-mono">
                  ${m.ratePerDay.toFixed(2)}/day
                </div>
                <div key={`e${i}`} className={`py-0.5 border-b border-gray-900 font-mono ${m.earningPct > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                  {rewards.active.length > 0 ? `${m.earningPct.toFixed(1)}%` : `${m.competitiveness.toFixed(0)}x`}
                </div>
                <div key={`s${i}`} className="py-0.5 border-b border-gray-900">
                  {rewards.active.length > 0
                    ? <span className="text-green-400">● EARNING</span>
                    : <span className="text-amber-700">◌ AVAILABLE</span>
                  }
                </div>
              </>
            ))}
          </div>
        )}
      </Panel>

      {/* Positions Table */}
      <Panel title={`OPEN POSITIONS (${portfolio.openCount} active / ${portfolio.totalPositions} total)`}>
        <PositionsTable positions={positions} />
      </Panel>

      {/* Footer */}
      <div className="mt-3 text-center text-gray-800 text-xs">
        POLYMARKET DASHBOARD  ·  DATA: data-api.polymarket.com  ·  AUTO-REFRESH: 60s
      </div>
    </div>
  );
}
