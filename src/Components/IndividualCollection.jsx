import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { API_BASE_URL } from './Constants.jsx';
import { FORM_BLOCK_OPTIONS, blockLabel, blockPhrase } from './blockAccess.js';

const GRADIENTS = [
  ['#1d4ed8', '#60a5fa'],
  ['#0f766e', '#5eead4'],
  ['#4f46e5', '#a5b4fc'],
  ['#0369a1', '#7dd3fc'],
  ['#7c3aed', '#d8b4fe'],
  ['#b45309', '#fcd34d'],
];

function formatRupees(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatRupeesExact(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-2xl border border-blue-100 bg-white/95 px-4 py-3 shadow-glow-soft">
      <p className="text-[10px] uppercase tracking-[0.2em] text-blue-500">{label || item.name}</p>
      <p className="mt-1 text-xl font-bold text-slate-800">{formatRupeesExact(item.value)}</p>
    </div>
  );
}

function CollectionChartHero({ title, subtitle, totalLabel, total, blockRows, prefix }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/70 px-5 py-4 md:px-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-blue-500/80">{title}</p>
          <h3 className="mt-1 text-xl md:text-2xl font-semibold text-slate-800">{subtitle}</h3>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">{totalLabel}</p>
          <p className="text-2xl md:text-3xl font-bold neon-text">{formatRupeesExact(total)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 p-4 md:p-6">
        <div className="lg:col-span-3 min-h-[260px]">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={blockRows} margin={{ top: 28, right: 12, left: 0, bottom: 8 }} barCategoryGap="32%">
              <defs>
                {GRADIENTS.map(([from, to], i) => (
                  <linearGradient key={i} id={`${prefix}-bar-${i}`} x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor={from} />
                    <stop offset="100%" stopColor={to} />
                  </linearGradient>
                ))}
              </defs>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 13, fontWeight: 600 }}
              />
              <YAxis hide />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(37,99,235,0.05)' }} />
              <Bar dataKey="amount" maxBarSize={72} radius={[14, 14, 6, 6]}>
                {blockRows.map((entry, index) => (
                  <Cell key={entry.name} fill={`url(#${prefix}-bar-${index % GRADIENTS.length})`} />
                ))}
                <LabelList
                  dataKey="amount"
                  position="top"
                  formatter={(value) => formatRupees(value)}
                  style={{ fill: '#1e293b', fontSize: 12, fontWeight: 700 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-2 relative min-h-[260px]">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <defs>
                {GRADIENTS.map(([from, to], i) => (
                  <linearGradient key={i} id={`${prefix}-pie-${i}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={from} />
                    <stop offset="100%" stopColor={to} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={blockRows.filter((row) => row.amount > 0)}
                dataKey="amount"
                nameKey="name"
                innerRadius="58%"
                outerRadius="82%"
                paddingAngle={blockRows.filter((row) => row.amount > 0).length > 1 ? 5 : 0}
                cornerRadius={8}
                stroke="none"
              >
                {blockRows.filter((row) => row.amount > 0).map((entry, index) => (
                  <Cell key={entry.name} fill={`url(#${prefix}-pie-${index % GRADIENTS.length})`} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Blocks</span>
            <span className="text-xl font-bold text-slate-800">
              {blockRows.filter((row) => row.amount > 0).length || 0}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 pb-5 md:px-6">
        {blockRows.map((row, index) => (
          <div key={row.name} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: GRADIENTS[index % GRADIENTS.length][0] }}
              />
              <p className="text-xs uppercase tracking-wider text-slate-500">{row.cardTitle || row.name}</p>
            </div>
            <p className="mt-1 text-lg font-bold text-slate-800">{formatRupeesExact(row.amount)}</p>
            <p className="text-xs text-slate-400">
              {row.detail || `${row.share}% of total`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminBlockTotals({ collectors }) {
  const segmentColors = {
    A: '#2563eb',
    B: '#0284c7',
    C: '#4f46e5',
    D: '#0f766e',
    Outside: '#b45309',
  };

  const grouped = FORM_BLOCK_OPTIONS.map((block) => {
    const members = collectors.filter(
      (c) => String(c.collectionBlock || '').trim().toLowerCase() === String(block).toLowerCase()
    );
    const amount = members.reduce((sum, c) => sum + (Number(c.totalAmount) || 0), 0);
    return {
      key: block,
      label: blockPhrase(block),
      amount,
      collectors: members.length,
      names: members.map((m) => m.name).filter(Boolean),
      color: segmentColors[block] || '#2563eb',
    };
  }).filter((row) => row.collectors > 0 || row.amount > 0);

  if (grouped.length === 0) return null;

  const ranked = [...grouped].sort((a, b) => b.amount - a.amount);
  const grandTotal = ranked.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-6 pt-6 pb-5 md:px-8 border-b border-slate-100">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Statement</p>
            <h3 className="mt-1 text-2xl font-semibold text-slate-800">Total collection by block</h3>
          </div>
          <p className="text-3xl font-bold tabular-nums text-slate-900">{formatRupeesExact(grandTotal)}</p>
        </div>

        <div className="mt-6 h-14 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/80">
          <div className="flex h-full w-full">
            {ranked.map((row) => {
              const share = grandTotal > 0 ? (row.amount / grandTotal) * 100 : 0;
              if (share <= 0) return null;
              return (
                <div
                  key={row.key}
                  className="relative flex h-full items-center justify-center text-white"
                  style={{
                    width: `${Math.max(share, 8)}%`,
                    backgroundColor: row.color,
                  }}
                  title={`${row.label}: ${formatRupeesExact(row.amount)}`}
                >
                  {share >= 12 && (
                    <span className="text-xs font-semibold tracking-wide">
                      {row.label} {Math.round(share)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {ranked.map((row, index) => {
          const share = grandTotal > 0 ? Math.round((row.amount / grandTotal) * 100) : 0;
          return (
            <div key={row.key} className="flex flex-wrap items-center gap-4 px-6 py-4 md:px-8">
              <span className="w-8 text-sm font-semibold tabular-nums text-slate-400">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <div className="min-w-[140px] flex-1">
                <p className="font-semibold text-slate-800">Total collection by {row.label}</p>
                <p className="text-xs text-slate-500">
                  {row.collectors} collector{row.collectors === 1 ? '' : 's'}
                  {row.names.length ? ` — ${row.names.join(', ')}` : ''}
                </p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{share}%</p>
              <p className="w-36 text-right text-lg font-bold tabular-nums text-slate-900">
                {formatRupeesExact(row.amount)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BlockCollectionHero({ collector, blockRows }) {
  const total = Number(collector.totalAmount) || 0;
  const prefix = `ic-${String(collector.email || collector.name || 'collector').replace(/[^a-z0-9]/gi, '')}`;

  return (
    <CollectionChartHero
      title="Collection by block"
      subtitle={collector.name}
      totalLabel="Combined total"
      total={total}
      blockRows={blockRows}
      prefix={prefix}
    />
  );
}

function CollectorsList({ collectors, selectedEmail, onSelect }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800">Collectors</h3>
        <p className="text-xs text-slate-500 mt-0.5">Select a collector to see block-wise totals.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider">
            <tr>
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Collection block</th>
              <th className="px-5 py-3 font-semibold">Total collected</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {collectors.map((collector) => (
              <tr
                key={collector.email}
                onClick={() => onSelect(collector.email)}
                className={`cursor-pointer transition hover:bg-blue-50/70 ${
                  selectedEmail === collector.email ? 'bg-blue-50' : ''
                }`}
              >
                <td className="px-5 py-3.5 font-semibold text-slate-900">{collector.name}</td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                    {blockPhrase(collector.collectionBlock) || '—'}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-semibold text-blue-700">{formatRupeesExact(collector.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CollectorSummary({ collector, collectorsPanel }) {
  const total = Number(collector.totalAmount) || 0;
  const blockRows = (collector.byBlock || []).map((row) => {
    const amount = Number(row.amount) || 0;
    return {
      name: blockLabel(row.block) || row.block,
      amount,
      share: total > 0 ? Math.round((amount / total) * 100) : 0,
    };
  });

  return (
    <div className="space-y-6">
      {blockRows.length > 0 ? (
        <BlockCollectionHero collector={collector} blockRows={blockRows} />
      ) : (
        <div className="glass-card px-5 py-8 text-center text-slate-500">
          No collected payments recorded for this login yet.
        </div>
      )}

      {collectorsPanel}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass-card px-5 py-4">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">Name</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{collector.name}</p>
        </div>
        <div className="glass-card px-5 py-4">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">Collection block</p>
          <p className="mt-1 text-2xl font-bold text-indigo-700">
            {blockPhrase(collector.collectionBlock) || '—'}
          </p>
        </div>
        <div className="glass-card px-5 py-4">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">Total collected</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{formatRupeesExact(total)}</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">Block-wise contribution</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Amount collected from each block this login can access, plus the combined total.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-5 py-3 font-semibold">Block</th>
                <th className="px-5 py-3 font-semibold">Collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {blockRows.length === 0 ? (
                <tr>
                  <td className="px-5 py-3.5 text-slate-500" colSpan={2}>
                    No collected payments recorded for this login yet.
                  </td>
                </tr>
              ) : (
                blockRows.map((row) => (
                  <tr key={row.name}>
                    <td className="px-5 py-3.5 text-slate-800">{row.name}</td>
                    <td className="px-5 py-3.5 font-semibold text-blue-700">{formatRupeesExact(row.amount)}</td>
                  </tr>
                ))
              )}
              <tr className="bg-blue-50/60">
                <td className="px-5 py-3.5 font-semibold text-slate-900">Total collected</td>
                <td className="px-5 py-3.5 font-bold text-blue-700">{formatRupeesExact(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function IndividualCollection({ user }) {
  const [collectors, setCollectors] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCollectors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/individual-collections`, {
        params: { email: user || '' },
      });
      const list = Array.isArray(data?.collectors) ? data.collectors : [];
      setCollectors(list);
      setIsAdmin(Boolean(data?.isAdmin));
      setSelectedEmail((prev) => {
        if (prev && list.some((c) => c.email === prev)) return prev;
        return list[0]?.email || '';
      });
    } catch (err) {
      console.error('Failed to load individual collections:', err);
      setError('Could not load individual collections.');
      setCollectors([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCollectors();
  }, [loadCollectors]);

  const selected = useMemo(
    () => collectors.find((c) => c.email === selectedEmail) || collectors[0] || null,
    [collectors, selectedEmail]
  );

  return (
    <div className="relative w-full min-h-full p-4 md:p-8 overflow-hidden">
      <div className="pointer-events-none absolute -top-24 left-10 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl animate-floatBlob" />
      <div className="pointer-events-none absolute bottom-0 -right-24 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl animate-floatBlob" style={{ animationDelay: '4s' }} />

      <div className="relative mb-8 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-blue-500/80">Collectors</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight neon-text">Individual Collection</h1>
        <p className="mt-2 text-sm text-slate-500">
          {isAdmin
            ? 'Admin view of each collector’s name, collection block, and totals from every block they collected in.'
            : 'Your name, collection block, amount from each block you collected in, and combined total.'}
        </p>
        <div className="mx-auto mt-4 h-[2px] w-40 rounded-full bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
      </div>

      {loading ? (
        <div className="glass-card p-10 flex items-center justify-center">
          <span className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="glass-card p-8 text-center text-rose-600">{error}</div>
      ) : !selected ? (
        <div className="glass-card p-8 text-center text-slate-500">
          No collection record for this login yet. Add a name and collection block on the user, then save payments while logged in.
        </div>
      ) : (
        <div className="relative space-y-6">
          {isAdmin && <AdminBlockTotals collectors={collectors} />}

          <CollectorSummary
            collector={selected}
            collectorsPanel={
              isAdmin && collectors.length > 1 ? (
                <CollectorsList
                  collectors={collectors}
                  selectedEmail={selectedEmail}
                  onSelect={setSelectedEmail}
                />
              ) : null
            }
          />
        </div>
      )}
    </div>
  );
}
