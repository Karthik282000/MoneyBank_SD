import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { API_BASE_URL } from './Constants.jsx';
import { FORM_BLOCK_OPTIONS, blockLabel, blockPhrase } from './blockAccess.js';

const BLOCK_COLORS = {
  A: '#2563eb',
  B: '#0284c7',
  C: '#4f46e5',
  D: '#0f766e',
  Outside: '#b45309',
};

function formatRupeesExact(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-2xl border border-blue-100 bg-white/95 px-4 py-3 shadow-glow-soft">
      <p className="text-[10px] uppercase tracking-[0.2em] text-blue-500">{item.name}</p>
      <p className="mt-1 text-xl font-bold text-slate-800">{formatRupeesExact(item.value)}</p>
    </div>
  );
}

function formatTxnDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB');
}

function groupCollectorsByBlock(collectors) {
  return FORM_BLOCK_OPTIONS.map((block) => {
    const members = collectors.filter(
      (c) => String(c.collectionBlock || '').trim().toLowerCase() === String(block).toLowerCase()
    );
    const amount = members.reduce((sum, c) => sum + (Number(c.totalAmount) || 0), 0);
    return {
      key: block,
      name: blockPhrase(block),
      amount,
      collectors: members.length,
      members,
      color: BLOCK_COLORS[block] || '#2563eb',
    };
  }).filter((row) => row.collectors > 0 || row.amount > 0);
}

function TransactionCards({ rows }) {
  if (rows.length === 0) {
    return <p className="px-5 py-4 text-sm text-slate-500">No transactions for this collector.</p>;
  }
  return (
    <>
      <div className="lg:hidden space-y-3 p-4">
        {rows.map((row, index) => (
          <div key={`${row.receipt_no || index}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 break-words">{row.name || '—'}</p>
                <p className="text-sm text-slate-500 mt-0.5">House {row.houseno || '—'}</p>
              </div>
              <p className="shrink-0 font-semibold text-blue-600">{formatRupeesExact(row.amount)}</p>
            </div>
            <div className="mt-2 space-y-1 text-xs text-slate-500">
              <p>{blockPhrase(row.block) || row.block || '—'} · {row.payment_mode || '—'}</p>
              <p className="break-all">Receipt {row.receipt_no || '—'}</p>
              <p className="break-all">Ref. {row.reference_receipt_no || '—'}</p>
              <p>{formatTxnDate(row.createdat)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider">
            <tr>
              <th className="px-5 py-3 font-semibold">Date</th>
              <th className="px-5 py-3 font-semibold">House</th>
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Block</th>
              <th className="px-5 py-3 font-semibold">Amount</th>
              <th className="px-5 py-3 font-semibold">Mode</th>
              <th className="px-5 py-3 font-semibold">Receipt</th>
              <th className="px-5 py-3 font-semibold">Ref.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={`${row.receipt_no || index}-${index}`} className="hover:bg-blue-50/60">
                <td className="px-5 py-3.5 text-slate-600">{formatTxnDate(row.createdat)}</td>
                <td className="px-5 py-3.5 text-slate-800">{row.houseno || '—'}</td>
                <td className="px-5 py-3.5 text-slate-800">{row.name || '—'}</td>
                <td className="px-5 py-3.5 text-slate-600">{blockLabel(row.block) || row.block || '—'}</td>
                <td className="px-5 py-3.5 font-semibold text-blue-700">{formatRupeesExact(row.amount)}</td>
                <td className="px-5 py-3.5 text-slate-600">{row.payment_mode || '—'}</td>
                <td className="px-5 py-3.5 text-slate-800">{row.receipt_no || '—'}</td>
                <td className="px-5 py-3.5 text-slate-600">{row.reference_receipt_no || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function BlockCollectorsModal({ blockRow, viewerEmail, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const emails = useMemo(
    () => (blockRow.members || []).map((m) => m.email).filter(Boolean),
    [blockRow.members]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/individual-collections/block-transactions`, {
          params: { viewer: viewerEmail || '', emails: JSON.stringify(emails) },
        });
        if (!cancelled) setRows(Array.isArray(data?.transactions) ? data.transactions : []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load transactions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [emails, viewerEmail]);

  const q = search.trim().toLowerCase();
  const grouped = useMemo(() => {
    const byEmail = {};
    for (const member of blockRow.members || []) {
      const email = String(member.email || '').toLowerCase();
      byEmail[email] = { member, rows: [] };
    }
    for (const row of rows) {
      const email = String(row.collector_email || '').toLowerCase();
      if (!byEmail[email]) {
        byEmail[email] = { member: { name: email, email }, rows: [] };
      }
      byEmail[email].rows.push(row);
    }
    return Object.values(byEmail).map((group) => {
      const filtered = group.rows.filter((row) => {
        if (!q) return true;
        return [
          row.houseno,
          row.name,
          row.contact,
          row.block,
          row.receipt_no,
          row.reference_receipt_no,
          row.payment_mode,
          group.member?.name,
        ].some((v) => String(v || '').toLowerCase().includes(q));
      });
      const total = filtered.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
      return { ...group, rows: filtered, total };
    }).filter((group) => !q || group.rows.length > 0);
  }, [blockRow.members, rows, q]);

  const grandTotal = grouped.reduce((sum, g) => sum + g.total, 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-[0_20px_60px_-10px_rgba(37,99,235,0.4)] ring-1 ring-blue-200 animate-fadeIn flex flex-col">
        <div className="px-4 sm:px-6 pt-5 pb-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-blue-100">Block collections</p>
              <h3 className="text-xl font-bold mt-1">{blockRow.name}</h3>
              <p className="text-sm text-blue-100 mt-1">
                {blockRow.collectors} collector{blockRow.collectors === 1 ? '' : 's'} · click a name section to review their receipts
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums">{formatRupeesExact(grandTotal)}</p>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search house, name, receipt or collector…"
            className="mt-4 w-full h-12 rounded-xl bg-white/95 border-0 px-4 text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-white/60"
          />
        </div>

        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="p-10 flex items-center justify-center">
              <span className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <p className="p-8 text-center text-rose-600">{error}</p>
          ) : grouped.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No transactions found for this block.</p>
          ) : (
            grouped.map((group) => (
              <section key={group.member.email || group.member.name} className="border-b border-slate-100 last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-5 py-3">
                  <div>
                    <h4 className="text-base font-bold text-slate-900">{group.member.name}</h4>
                    <p className="text-xs text-slate-500">{group.rows.length} transaction{group.rows.length === 1 ? '' : 's'}</p>
                  </div>
                  <p className="text-lg font-bold text-blue-700">{formatRupeesExact(group.total)}</p>
                </div>
                <TransactionCards rows={group.rows} />
              </section>
            ))
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100">
          <button type="button" className="btn-neon w-full" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminBlockOverview({ collectors, onOpenBlock }) {
  const grouped = useMemo(() => groupCollectorsByBlock(collectors), [collectors]);
  const ranked = useMemo(() => [...grouped].sort((a, b) => b.amount - a.amount), [grouped]);
  const pieData = ranked.filter((row) => row.amount > 0);
  const grandTotal = ranked.reduce((sum, row) => sum + row.amount, 0);

  if (ranked.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="glass-card overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/70 px-5 py-5 md:px-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-blue-500/80">Distribution</p>
            <h3 className="mt-1 text-xl md:text-2xl font-semibold text-slate-800">Block-wise total collection</h3>
            <p className="mt-1 text-xs text-slate-500">Share of each collection block across all named collectors.</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">Combined total</p>
            <p className="text-2xl md:text-3xl font-bold neon-text">{formatRupeesExact(grandTotal)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 p-4 md:p-6">
          <div className="lg:col-span-3 relative min-h-[300px]">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius="54%"
                  outerRadius="82%"
                  paddingAngle={pieData.length > 1 ? 4 : 0}
                  cornerRadius={8}
                  stroke="none"
                  onClick={(_, index) => {
                    const row = pieData[index];
                    if (row) onOpenBlock(row);
                  }}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} className="cursor-pointer outline-none" />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Blocks</span>
              <span className="text-2xl font-bold text-slate-800">{pieData.length}</span>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col justify-center gap-2">
            {ranked.map((row) => {
              const share = grandTotal > 0 ? Math.round((row.amount / grandTotal) * 100) : 0;
              return (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => onOpenBlock(row)}
                  className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-white hover:shadow-sm"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{row.name}</p>
                    <p className="text-[11px] text-slate-500">{share}% · {row.collectors} collector{row.collectors === 1 ? '' : 's'}</p>
                  </div>
                  <p className="text-sm font-bold tabular-nums text-slate-900">{formatRupeesExact(row.amount)}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function CollectorTransactionsPanel({ collector, viewerEmail }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/individual-collections/transactions`, {
          params: { email: collector.email, viewer: viewerEmail || '' },
        });
        if (!cancelled) setRows(Array.isArray(data?.transactions) ? data.transactions : []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load transactions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [collector.email, viewerEmail]);

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800">Your collected transactions</h3>
        <p className="text-xs text-slate-500 mt-0.5">Every collected or completed receipt recorded under this login.</p>
      </div>
      {loading ? (
        <div className="p-10 flex items-center justify-center">
          <span className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="p-8 text-center text-rose-600">{error}</p>
      ) : (
        <TransactionCards rows={rows} />
      )}
    </div>
  );
}

function NonAdminSummary({ collector, viewerEmail }) {
  const total = Number(collector.totalAmount) || 0;
  const blockRows = (collector.byBlock || []).map((row) => {
    const amount = Number(row.amount) || 0;
    return {
      name: blockLabel(row.block) || row.block,
      amount,
    };
  });

  return (
    <div className="space-y-6">
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

      <CollectorTransactionsPanel collector={collector} viewerEmail={viewerEmail} />
    </div>
  );
}

export default function IndividualCollection({ user }) {
  const [collectors, setCollectors] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [blockModal, setBlockModal] = useState(null);

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

  const self = collectors[0] || null;

  return (
    <div className="relative w-full min-h-full p-4 md:p-8 overflow-hidden">
      <div className="pointer-events-none absolute -top-24 left-10 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl animate-floatBlob" />
      <div className="pointer-events-none absolute bottom-0 -right-24 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl animate-floatBlob" style={{ animationDelay: '4s' }} />

      <div className="relative mb-8 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-blue-500/80">Collectors</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight neon-text">Individual Collection</h1>
        <p className="mt-2 text-sm text-slate-500">
          {isAdmin
            ? 'Block-wise totals across collectors. Open a block to review each person’s transactions.'
            : 'Your name, collection block, totals, and the transactions you have collected.'}
        </p>
        <div className="mx-auto mt-4 h-[2px] w-40 rounded-full bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
      </div>

      {loading ? (
        <div className="glass-card p-10 flex items-center justify-center">
          <span className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="glass-card p-8 text-center text-rose-600">{error}</div>
      ) : isAdmin ? (
        collectors.length === 0 ? (
          <div className="glass-card p-8 text-center text-slate-500">
            No collector records yet.
          </div>
        ) : (
          <AdminBlockOverview collectors={collectors} onOpenBlock={setBlockModal} />
        )
      ) : !self ? (
        <div className="glass-card p-8 text-center text-slate-500">
          No collection record for this login yet. Add a name and collection block on the user, then save payments while logged in.
        </div>
      ) : (
        <NonAdminSummary collector={self} viewerEmail={user} />
      )}

      {blockModal && (
        <BlockCollectorsModal
          blockRow={blockModal}
          viewerEmail={user}
          onClose={() => setBlockModal(null)}
        />
      )}
    </div>
  );
}
