import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import './Home.css';
import { API_BASE_URL } from './Constants.jsx';

function amountToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  function toWords(n) {
    n = Math.floor(Number(n));
    if (!n || Number.isNaN(n)) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + toWords(n % 100) : '');
    if (n < 100000) return toWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + toWords(n % 1000) : '');
    if (n < 10000000) return toWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + toWords(n % 100000) : '');
    return toWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + toWords(n % 10000000) : '');
  }
  return toWords(num).toUpperCase();
}

// Premium gradient stop pairs used to paint the donut slices (presentation only)
const GRADIENTS = [
  ['#2563eb', '#60a5fa'],
  ['#0ea5e9', '#67e8f9'],
  ['#4f46e5', '#818cf8'],
  ['#14b8a6', '#5eead4'],
  ['#8b5cf6', '#c4b5fd'],
  ['#0891b2', '#22d3ee'],
  ['#3b82f6', '#93c5fd'],
  ['#6366f1', '#a5b4fc'],
  ['#0284c7', '#38bdf8'],
];

// Glassy tooltip for the charts (presentation only)
function ChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-glow-soft">
      <p className="text-xs uppercase tracking-wider text-blue-600">{item.name}</p>
      <p className="text-lg font-bold text-slate-800">{item.value}</p>
    </div>
  );
}

// Reusable premium donut chart (presentation only — receives the same data)
function PremiumDonut({ data = [], gradientPrefix }) {
  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  return (
    <div className="relative h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            {GRADIENTS.map(([from, to], i) => (
              <linearGradient
                key={i}
                id={`${gradientPrefix}-grad-${i}`}
                x1="0" y1="0" x2="1" y2="1"
              >
                <stop offset="0%" stopColor={from} />
                <stop offset="100%" stopColor={to} />
              </linearGradient>
            ))}
          </defs>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={62}
            outerRadius={92}
            paddingAngle={data.length > 1 ? 4 : 0}
            cornerRadius={8}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={`url(#${gradientPrefix}-grad-${index % GRADIENTS.length})`}
              />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'transparent' }} />
          <Legend
            verticalAlign="bottom"
            height={28}
            iconType="circle"
            formatter={(value) => (
              <span className="text-xs text-slate-600">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Center total overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center -translate-y-3">
        <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Total</span>
        <span className="text-3xl font-bold neon-text">{total}</span>
      </div>
    </div>
  );
}

const BLOCK_STATS = [
  {
    key: 'total',
    label: 'Total people',
    hint: 'Active members in this block',
    tile: 'from-indigo-500 to-blue-500',
    chip: 'bg-white/20 text-white ring-white/30',
    amountKey: null,
    modal: {
      overlay: 'bg-indigo-950/45',
      panel: 'ring-2 ring-indigo-300',
      header: 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white',
      eyebrow: 'text-indigo-100',
      thead: 'bg-indigo-600 text-white',
      row: 'hover:bg-indigo-50/80',
      amount: 'text-indigo-700',
      footer: 'bg-indigo-50 border-indigo-100',
      close: 'bg-gradient-to-r from-indigo-600 to-blue-600',
    },
  },
  {
    key: 'completed',
    label: 'Completed',
    hint: 'At least one collected transaction',
    tile: 'from-emerald-500 to-teal-500',
    chip: 'bg-white/20 text-white ring-white/30',
    amountKey: 'collected_amount',
    modal: {
      overlay: 'bg-emerald-950/45',
      panel: 'ring-2 ring-emerald-300',
      header: 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white',
      eyebrow: 'text-emerald-100',
      thead: 'bg-emerald-600 text-white',
      row: 'hover:bg-emerald-50/80',
      amount: 'text-emerald-700',
      footer: 'bg-emerald-50 border-emerald-100',
      close: 'bg-gradient-to-r from-emerald-600 to-teal-600',
    },
  },
  {
    key: 'notCompleted',
    label: 'Not completed',
    hint: 'No transaction yet',
    tile: 'from-slate-500 to-slate-600',
    chip: 'bg-white/20 text-white ring-white/30',
    amountKey: null,
    modal: {
      overlay: 'bg-slate-900/50',
      panel: 'ring-2 ring-slate-300',
      header: 'bg-gradient-to-r from-slate-600 to-slate-700 text-white',
      eyebrow: 'text-slate-200',
      thead: 'bg-slate-600 text-white',
      row: 'hover:bg-slate-50',
      amount: 'text-slate-600',
      footer: 'bg-slate-100 border-slate-200',
      close: 'bg-gradient-to-r from-slate-600 to-slate-700',
    },
  },
  {
    key: 'due',
    label: 'Due receipts',
    hint: 'Open due receipt on file',
    tile: 'from-rose-500 to-orange-500',
    chip: 'bg-white/20 text-white ring-white/30',
    amountKey: 'due_amount',
    modal: {
      overlay: 'bg-rose-950/45',
      panel: 'ring-2 ring-rose-300',
      header: 'bg-gradient-to-r from-rose-600 to-orange-500 text-white',
      eyebrow: 'text-rose-100',
      thead: 'bg-rose-600 text-white',
      row: 'hover:bg-rose-50/80',
      amount: 'text-rose-700',
      footer: 'bg-rose-50 border-rose-100',
      close: 'bg-gradient-to-r from-rose-600 to-orange-500',
    },
  },
];

function Home({ allowedBlocks = [] }) {
  const navigate = useNavigate();
  const [statusData, setStatusData] = useState([]);
  const [blockOverview, setBlockOverview] = useState([]);
  const [dueHouseList, setDueHouseList] = useState([]);
  const [statModal, setStatModal] = useState(null);
  const [statSearch, setStatSearch] = useState('');

  const [receipts, setReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [liveReceiptSvgUrl, setLiveReceiptSvgUrl] = useState('');

  const [filterHouse, setFilterHouse] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterRefReceipt, setFilterRefReceipt] = useState("");
  const [dueFilterHouse, setDueFilterHouse] = useState("");
  const [dueFilterName, setDueFilterName] = useState("");
  const [dueFilterBlock, setDueFilterBlock] = useState("");
  const [dueFilterRef, setDueFilterRef] = useState("");
  const [config, setConfig] = useState({});

  const [showDue, setShowDue] = useState(false);
  const [showReceipts, setShowReceipts] = useState(false);

  // Open a receipt using a freshly rebuilt SVG from the server (includes
  // Mahastmi Bhog line + DUE stamp), instead of a possibly stale stored image.
  const openReceipt = async (receipt) => {
    setSelectedReceipt(receipt);
    setLiveReceiptSvgUrl('');
    setShowReceiptModal(true);
    try {
      const url = `${API_BASE_URL}/api/receipt-svg/${encodeURIComponent(receipt.receipt_no)}?t=${Date.now()}`;
      setLiveReceiptSvgUrl(url);
    } catch (err) {
      console.error('Failed to load live receipt SVG', err);
    }
  };

  const fetchReceipts = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/receipts`, {
        params: { allowedBlocks: JSON.stringify(allowedBlocks.length ? allowedBlocks : ['ALLBLOCKS']) }
      });
      setReceipts(res.data || []);
    } catch (err) {
      console.error("Failed to fetch receipts", err);
    }
  }, [allowedBlocks]);

  const fetchDashboardData = useCallback(() => {
    axios.post(`${API_BASE_URL}/api/dashboard/summary`, {
      allowedBlocks: allowedBlocks.length ? allowedBlocks : ['ALLBLOCKS']
    })
      .then(res => {
        const data = res.data || {};
        const cs = data.customerStatus || {};
        setStatusData([
          { name: 'Paid', value: cs.paid || 0 },
          { name: 'Pending', value: cs.pending || 0 }
        ]);

        setDueHouseList(data.dueHousenos || []);
        setBlockOverview(data.blockOverview || []);
      })
      .catch(err => {
        console.error(err);
        setStatusData([]);
        setDueHouseList([]);
        setBlockOverview([]);
      });
  }, [allowedBlocks]);  // ✅ IMPORTANT DEPENDENCY


  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/receipt-config`);
      setConfig(res.data);
    } catch (err) {
      console.error("Failed to fetch config", err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchReceipts();
    fetchConfig();
  }, [fetchDashboardData, fetchReceipts, allowedBlocks]);

  // Send the collector to the Pay Subscription form with this due entry
  // pre-filled, so they can add the payment mode and finalize it.
  const handleCompleteDue = (row) => {
    navigate('/pay', { state: { completeDue: row } });
  };



  const filteredReceipts = receipts.filter((r) => {
    const house = (r.houseno || "").toLowerCase();
    const name = (r.name || "").toLowerCase();
    const refNo = (r.reference_receipt_no || "").toLowerCase();
    const sysNo = (r.receipt_no || "").toLowerCase();

    const matchHouse = filterHouse ? house.includes(filterHouse.toLowerCase()) : true;
    const matchName = filterName ? name.includes(filterName.toLowerCase()) : true;
    const matchRef = filterRefReceipt
      ? refNo.includes(filterRefReceipt.toLowerCase()) || sysNo.includes(filterRefReceipt.toLowerCase())
      : true;

    const receiptDate = r.created_at
      ? new Date(r.created_at).toLocaleDateString("en-CA")
      : "";
    const matchDate = filterDate ? receiptDate === filterDate : true;

    return matchHouse && matchName && matchRef && matchDate;
  });

  const filteredDueList = dueHouseList.filter((row) => {
    const house = (row.houseno || "").toLowerCase();
    const name = (row.name || "").toLowerCase();
    const block = (row.block || "").toLowerCase();
    const refNo = (row.reference_receipt_no || "").toLowerCase();
    const sysNo = (row.receipt_no || "").toLowerCase();

    const matchHouse = dueFilterHouse ? house.includes(dueFilterHouse.toLowerCase()) : true;
    const matchName = dueFilterName ? name.includes(dueFilterName.toLowerCase()) : true;
    const matchBlock = dueFilterBlock ? block.includes(dueFilterBlock.toLowerCase()) : true;
    const matchRef = dueFilterRef
      ? refNo.includes(dueFilterRef.toLowerCase()) || sysNo.includes(dueFilterRef.toLowerCase())
      : true;

    return matchHouse && matchName && matchBlock && matchRef;
  });

  return (
    <div className="relative w-full min-h-full p-4 md:p-8 overflow-hidden">

      {/* Ambient animated glow blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl animate-floatBlob" />
      <div className="pointer-events-none absolute top-40 -right-24 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl animate-floatBlob" style={{ animationDelay: '3s' }} />

      {/* HEADER */}
      <div className="relative mb-10 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-blue-500/80">Sarbojanin Durgotsab</p>
        <h2 className="mt-2 text-3xl md:text-5xl font-bold tracking-tight neon-text">
          Dashboard Overview
        </h2>
        <div className="mx-auto mt-4 h-[2px] w-40 rounded-full bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
      </div>

      {/* OVERVIEW */}
      <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="group glass-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-glow-violet">
          <h4 className="mb-1 text-center text-sm font-semibold uppercase tracking-widest text-slate-500">
            Customers Status
          </h4>
          <PremiumDonut data={statusData} gradientPrefix="status" />
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {blockOverview.length === 0 ? (
            <div className="sm:col-span-2 glass-card p-8 text-center text-slate-500">
              No block data available for your access.
            </div>
          ) : (
            blockOverview.map((blk) => {
              const pct = blk.total ? Math.round((blk.completed / blk.total) * 100) : 0;
              return (
                <div key={blk.block} className="glass-card p-5 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.25em] text-blue-500 font-semibold">Block</p>
                      <h3 className="text-2xl font-bold neon-text leading-tight">{blk.block}</h3>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {pct}% collected
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-4">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {BLOCK_STATS.map((stat) => (
                      <button
                        key={stat.key}
                        type="button"
                        onClick={() => {
                          setStatSearch('');
                          setStatModal({
                            block: blk.block,
                            key: stat.key,
                            label: stat.label,
                            hint: stat.hint,
                            chip: stat.chip,
                            amountKey: stat.amountKey,
                            modal: stat.modal,
                            rows: blk.lists?.[stat.key] || [],
                          });
                        }}
                        className="text-left rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                      >
                        <p className="text-[11px] uppercase tracking-wider text-slate-500">{stat.label}</p>
                        <p className={`mt-1 text-2xl font-bold bg-gradient-to-r ${stat.tile} bg-clip-text text-transparent`}>
                          {blk[stat.key] ?? 0}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* DUE TABLE */}
      {/* ================= DUE HOUSE LIST (COLLAPSIBLE) ================= */}
      <div className="relative mt-8 glass-card overflow-hidden">

        {/* HEADER */}
        <div
          className="flex justify-between items-center p-5 cursor-pointer transition hover:bg-blue-50/70"
          onClick={() => setShowDue(!showDue)}
        >
          <h4 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <span className="h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.9)]" />
            Due House List
          </h4>
          <span className="text-blue-500 text-lg transition-transform duration-300" style={{ transform: showDue ? 'rotate(180deg)' : 'none' }}>
            ▼
          </span>
        </div>

        {/* CONTENT */}
        {showDue && (
          <div className="p-5 pt-0 animate-fadeIn space-y-4">

            <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <p className="text-xs uppercase tracking-[0.2em] text-rose-500 font-semibold">Query due receipts</p>
                <span className="text-xs font-medium text-slate-500">
                  {filteredDueList.length} of {dueHouseList.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-4 gap-y-4 items-end">
                <div className="field">
                  <label className="field-label">House no</label>
                  <input
                    type="text"
                    value={dueFilterHouse}
                    onChange={(e) => setDueFilterHouse(e.target.value)}
                    placeholder="e.g. A1B1"
                    className="input-neon"
                  />
                </div>
                <div className="field">
                  <label className="field-label">Name</label>
                  <input
                    type="text"
                    value={dueFilterName}
                    onChange={(e) => setDueFilterName(e.target.value)}
                    placeholder="Subscriber name"
                    className="input-neon"
                  />
                </div>
                <div className="field">
                  <label className="field-label">Block</label>
                  <input
                    type="text"
                    value={dueFilterBlock}
                    onChange={(e) => setDueFilterBlock(e.target.value)}
                    placeholder="A / B / C"
                    className="input-neon"
                  />
                </div>
                <div className="field">
                  <label className="field-label">Ref. receipt</label>
                  <input
                    type="text"
                    value={dueFilterRef}
                    onChange={(e) => setDueFilterRef(e.target.value)}
                    placeholder="Physical or system no"
                    className="input-neon"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDueFilterHouse('');
                    setDueFilterName('');
                    setDueFilterBlock('');
                    setDueFilterRef('');
                  }}
                  className="btn-ghost h-12 w-full"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left">

                <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white uppercase text-xs tracking-wider">
                  <tr>
                    <th className="p-3">House</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Block</th>
                    <th className="p-3">Ref. Receipt</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>

                <tbody className="text-slate-700">
                  {filteredDueList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-4 text-slate-500">No due records</td>
                    </tr>
                  ) : (
                    filteredDueList.map((row, idx) => (
                      <tr key={row.receipt_no || `${row.houseno}-${idx}`} className="border-b border-slate-100 transition hover:bg-blue-50/60">
                        <td className="p-3 font-medium text-slate-900">{row.houseno}</td>
                        <td className="p-3">{row.name}</td>
                        <td className="p-3">{row.block}</td>
                        <td className="p-3 text-slate-600">{row.reference_receipt_no || '—'}</td>
                        <td className="p-3 text-blue-600 font-semibold">₹ {row.amount}</td>
                        <td className="p-3">
                          <button
                            className="btn-neon !px-4 !py-1.5 text-xs"
                            onClick={() => handleCompleteDue(row)}
                          >
                            Complete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

              </table>
            </div>

          </div>
        )}

      </div>

      <div className="mt-6 glass-card overflow-hidden">
        <div
          className="flex justify-between items-center p-5 cursor-pointer transition hover:bg-blue-50/70"
          onClick={() => setShowReceipts(!showReceipts)}
        >
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.7)]" />
            Generated Receipts
          </h3>
          <span className="text-blue-500 text-lg transition-transform duration-300" style={{ transform: showReceipts ? 'rotate(180deg)' : 'none' }}>
            ▼
          </span>
        </div>

        {showReceipts && (
          <div className="px-5 pb-5 space-y-4 animate-fadeIn">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <p className="text-xs uppercase tracking-[0.2em] text-blue-500 font-semibold">Filter receipts</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                  {filteredReceipts.length} match{filteredReceipts.length === 1 ? '' : 'es'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-4 gap-y-4 items-end">
                <div className="field">
                  <label className="field-label">House no</label>
                  <input
                    type="text"
                    placeholder="e.g. A1B1"
                    value={filterHouse}
                    onChange={(e) => setFilterHouse(e.target.value)}
                    className="input-neon"
                  />
                </div>
                <div className="field">
                  <label className="field-label">Name</label>
                  <input
                    type="text"
                    placeholder="Subscriber name"
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    className="input-neon"
                  />
                </div>
                <div className="field">
                  <label className="field-label">Reference receipt</label>
                  <input
                    type="text"
                    placeholder="Physical or system no"
                    value={filterRefReceipt}
                    onChange={(e) => setFilterRefReceipt(e.target.value)}
                    className="input-neon"
                  />
                </div>
                <div className="field">
                  <label className="field-label">Date</label>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="input-neon"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFilterHouse("");
                    setFilterName("");
                    setFilterDate("");
                    setFilterRefReceipt("");
                  }}
                  className="btn-ghost h-12 w-full"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">

                <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white uppercase text-xs tracking-wider text-left">
                  <tr>
                    <th className="p-3">Receipt</th>
                    <th className="p-3">Ref. Receipt</th>
                    <th className="p-3">House</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>

                <tbody className="text-slate-700">
                  {filteredReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center p-4 text-slate-500">
                        No receipts found
                      </td>
                    </tr>
                  ) : (
                    filteredReceipts.map((r, index) => (
                      <tr key={index} className="border-b border-slate-100 transition hover:bg-blue-50/60">
                        <td className="p-3 font-medium text-slate-900">{r.receipt_no}</td>
                        <td className="p-3 text-slate-600">{r.reference_receipt_no || '—'}</td>
                        <td className="p-3">{r.houseno}</td>
                        <td className="p-3">{r.name}</td>
                        <td className="p-3 text-blue-600 font-semibold">₹ {r.amount}</td>
                        <td className="p-3">
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <button
                            className="btn-neon !px-4 !py-1.5 text-xs"
                            onClick={() => openReceipt(r)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL */}
      {showReceiptModal && selectedReceipt && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-2 py-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-[0_20px_60px_-10px_rgba(37,99,235,0.4)] ring-1 ring-blue-200 overflow-y-auto max-h-[90vh] animate-fadeIn">

                  {/* Live rebuilt SVG (Mahastmi Bhog + DUE) — falls back to stored image / HTML */}
                  {liveReceiptSvgUrl ? (
                    <div className="m-3">
                      <img
                        src={liveReceiptSvgUrl}
                        alt={`Receipt ${selectedReceipt.receipt_no}`}
                        className="w-full h-auto rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                  ) : selectedReceipt.receipt_image_url ? (
                    <div className="m-3">
                      <img
                        src={selectedReceipt.receipt_image_url}
                        alt={`Receipt ${selectedReceipt.receipt_no}`}
                        className="w-full h-auto rounded-lg border border-slate-200"
                      />
                    </div>
                  ) : (
                  /* RECEIPT (fallback HTML layout) */
                  <div className="border-2 border-dashed border-blue-700 m-3 p-4 text-blue-900 font-serif">

                    {/* HEADER */}
                    <div className="flex justify-between text-sm font-semibold">
                      <span>No. {selectedReceipt.receipt_no}</span>
                      <span className="text-gray-800">
                        Date: {new Date(selectedReceipt.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {selectedReceipt.reference_receipt_no ? (
                      <div className="text-xs text-gray-700 mt-1">
                        Ref. Receipt No: <span className="font-semibold">{selectedReceipt.reference_receipt_no}</span>
                      </div>
                    ) : null}

                    {/* TITLE */}
                    <h2 className="text-center text-lg font-bold mt-2">
                      Sarbojanin Durgotsab, 2026
                    </h2>

                    {/* ORG */}
                    <div className="text-center text-xs mt-1 text-gray-800 leading-tight">
                      Organised by :
                      <div className="font-bold text-blue-800">
                        SARBOJANIN DURGOTSAB COMMITTEE, LAKE GARDENS
                      </div>
                      <div className="font-semibold">
                        Lake Gardens People’s Association
                      </div>
                      <div className="text-blue-800">
                        At Bangur Park, Kolkata - 700045
                      </div>
                    </div>

                    <hr className="border-blue-700 my-2" />

                    {/* BODY */}
                    <div className="text-center italic text-sm leading-snug space-y-1">

                      <p>
                        Received with thanks from{" "}
                        <span className="font-bold text-gray-800">
                          {selectedReceipt.name}
                        </span>
                      </p>

                      <p>
                        of{" "}
                        <span className="font-bold text-gray-800">
                          {selectedReceipt.houseno}
                        </span>
                      </p>

                      <p>
                        The sum of Rupees{" "}
                        <span className="font-bold text-gray-800">
                          {amountToWords(selectedReceipt.amount) || selectedReceipt.amount} only
                        </span>
                      </p>

                      <p>
                        by{" "}
                        <span className="font-bold text-gray-800">
                          {selectedReceipt.payment_mode || "Cash"}
                        </span>
                      </p>

                      <p className="text-xs">
                        as subscription/donation for Durga Puja & Kali Puja 2026
                      </p>

                    </div>

                    {/* AMOUNT */}
                    <div className="flex justify-center mt-3">
                      <div className="border border-blue-700 rounded px-5 py-1 text-lg font-bold">
                        ₹ {selectedReceipt.amount}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-blue-800">
                        Please collect your "Mahastmi Bhog" from pandal Between 1 pm to 3 pm
                      </p>
                      <div className="flex h-20 w-20 flex-col items-center justify-center border-2 border-blue-800 text-center">
                        <span className="text-[9px] font-bold text-blue-800">BHOG PACKETS</span>
                        <span className="text-2xl font-bold text-gray-800">{selectedReceipt.bhog || 0}</span>
                      </div>
                    </div>

                    {(selectedReceipt.status || '').toLowerCase() === 'due' && (
                      <div className="mt-3 text-center border-2 border-red-600 bg-red-50 py-1 font-bold tracking-[0.3em] text-red-600">
                        DUE
                      </div>
                    )}

                    {/* SIGNATURES */}
                    <div className="grid grid-cols-3 text-center mt-6 text-xs gap-2">

                      <div>
                        <p className="font-bold">{selectedReceipt.president || config?.president || "Sarbani Basu Roy"}</p>
                        <p className="italic">President</p>
                      </div>

                      <div>
                        <p className="font-bold">{selectedReceipt.secretary1 || config?.secretary1}</p>
                        <p className="font-bold">{selectedReceipt.secretary2 || config?.secretary2}</p>
                        <p className="italic">Jt. Secretaries</p>
                      </div>

                      <div>
                        <p className="font-bold">{selectedReceipt.treasurer || config?.treasurer}</p>
                        <p className="italic">Treasurer</p>
                      </div>

                    </div>

                  </div>
                  )}

                  {/* BUTTON */}
                  <div className="p-4 bg-slate-50">
                    <button
                      className="btn-neon w-full"
                      onClick={() => {
                        setShowReceiptModal(false);
                        setLiveReceiptSvgUrl('');
                      }}
                    >
                      Close
                    </button>
                  </div>

          </div>
        </div>
      )}

      {statModal && (() => {
        const theme = statModal.modal || BLOCK_STATS[0].modal;
        const q = statSearch.trim().toLowerCase();
        const rows = (statModal.rows || []).filter((m) => {
          if (!q) return true;
          return (
            String(m.houseno || '').toLowerCase().includes(q) ||
            String(m.name || '').toLowerCase().includes(q) ||
            String(m.contact || '').toLowerCase().includes(q)
          );
        });
        return (
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm px-3 py-4 ${theme.overlay}`}>
          <div className={`w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl animate-fadeIn flex flex-col ${theme.panel}`}>
            <div className={`px-5 md:px-6 pt-5 pb-4 ${theme.header}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={`text-[11px] uppercase tracking-[0.25em] font-semibold ${theme.eyebrow}`}>
                    Block {statModal.block}
                  </p>
                  <h3 className="text-2xl font-bold mt-1">{statModal.label}</h3>
                  <p className="text-sm mt-1 opacity-90">{statModal.hint}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${statModal.chip}`}>
                  {statModal.rows.length} member{statModal.rows.length === 1 ? '' : 's'}
                </span>
              </div>
              <input
                type="text"
                value={statSearch}
                onChange={(e) => setStatSearch(e.target.value)}
                placeholder="Search house no or name…"
                className="mt-4 w-full h-12 rounded-xl bg-white/95 border-0 px-4 text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-white/60"
              />
            </div>

            <div className="overflow-auto flex-1">
              {rows.length === 0 ? (
                <p className="p-8 text-center text-slate-500">No members in this category.</p>
              ) : (
                  <table className="w-full text-sm text-left">
                    <thead className={`sticky top-0 uppercase text-[11px] tracking-wider ${theme.thead}`}>
                      <tr>
                        <th className="px-5 py-3 font-semibold">House</th>
                        <th className="px-5 py-3 font-semibold">Name</th>
                        <th className="px-5 py-3 font-semibold">Contact</th>
                        <th className="px-5 py-3 font-semibold">Email</th>
                        <th className="px-5 py-3 font-semibold">
                          {statModal.key === 'due' ? 'Due amount' : 'Collected'}
                        </th>
                        <th className="px-5 py-3 font-semibold">Flags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((m, idx) => (
                        <tr key={`${m.houseno}-${m.name}-${idx}`} className={theme.row}>
                          <td className="px-5 py-3 font-semibold text-slate-900">{m.houseno}</td>
                          <td className="px-5 py-3 text-slate-700">{m.name}</td>
                          <td className="px-5 py-3 text-slate-600">{m.contact || '—'}</td>
                          <td className="px-5 py-3 text-slate-600">{m.email || '—'}</td>
                          <td className={`px-5 py-3 font-semibold ${theme.amount}`}>
                            {statModal.key === 'notCompleted'
                              ? '—'
                              : `₹ ${Number(
                                  statModal.key === 'due' ? m.due_amount : m.collected_amount || 0
                                ).toFixed(2)}`}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap gap-1">
                              {m.has_completed && (
                                <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-semibold">Collected</span>
                              )}
                              {m.has_due && (
                                <span className="rounded-full bg-rose-50 text-rose-700 px-2 py-0.5 text-[11px] font-semibold">Due</span>
                              )}
                              {!m.has_transaction && (
                                <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[11px] font-semibold">No txn</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              )}
            </div>

            <div className={`p-4 border-t ${theme.footer}`}>
              <button
                type="button"
                className={`w-full inline-flex items-center justify-center rounded-xl px-5 py-2.5 font-semibold text-white shadow-md transition hover:-translate-y-0.5 ${theme.close}`}
                onClick={() => {
                  setStatModal(null);
                  setStatSearch('');
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
        );
      })()}

    </div>
  );
}

export default Home;