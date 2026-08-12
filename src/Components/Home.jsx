import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import './Home.css';
import { API_BASE_URL } from './Constants.jsx';
import { FiCalendar } from "react-icons/fi";

// const COLORS = [
//   '#0088FE', '#00C49F', '#FF8042', '#FFBB28',
//   '#A28CFE', '#FF4F81', '#50C9CE', '#4caf50', '#ff3d00'
// ];

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

function Home({ allowedBlocks = [] }) {
  const [statusData, setStatusData] = useState([]);
  const [modeData, setModeData] = useState([]);
  const [receiptStatusData, setReceiptStatusData] = useState([]);
  const [dueHouseList, setDueHouseList] = useState([]);

  const [receipts, setReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const [filterHouse, setFilterHouse] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [config, setConfig] = useState({});

  const [showDue, setShowDue] = useState(false);
  const [showReceipts, setShowReceipts] = useState(false);

  const fetchReceipts = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/receipts`);
      setReceipts(res.data || []);
    } catch (err) {
      console.error("Failed to fetch receipts", err);
    }
  };

  const fetchDashboardData = useCallback(() => {

    axios.post(`${API_BASE_URL}/api/dashboard/customer-status`, {
      allowedBlocks: allowedBlocks.length ? allowedBlocks : ['ALLBLOCKS']
    })
      .then(res => {
        const data = res.data;
        setStatusData([
          { name: 'Paid', value: data.paid || 0 },
          { name: 'Pending', value: data.pending || 0 }
        ]);
      })
      .catch(err => {
        setStatusData([]);
        console.error(err);
      });

    axios.post(`${API_BASE_URL}/api/dashboard/payment-modes`, {
      allowedBlocks: allowedBlocks.length ? allowedBlocks : ['ALLBLOCKS']
    })
      .then(res => {
        setModeData(
          (res.data || []).map(d => ({
            name: d.mode,
            value: Number(d.count)
          }))
        );
      })
      .catch(() => setModeData([]));

    axios.post(`${API_BASE_URL}/api/dashboard/receipt-status`, {
      allowedBlocks: allowedBlocks.length ? allowedBlocks : ['ALLBLOCKS']
    })
      .then(res => {
        setReceiptStatusData([
          { name: 'Collected', value: res.data.collected || 0 },
          { name: 'Due', value: res.data.due || 0 },
          { name: 'Pending', value: res.data.pending || 0 }
        ]);
      })
      .catch(() => setReceiptStatusData([]));

    axios.post(`${API_BASE_URL}/api/dashboard/due-housenos`, {
      allowedBlocks: allowedBlocks.length ? allowedBlocks : ['ALLBLOCKS']
    })
      .then(res => setDueHouseList(res.data || []))
      .catch(() => setDueHouseList([]));

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
  }, [fetchDashboardData, allowedBlocks]);

  const handleChangeStatus = async (houseno, name) => {
    try {
      await axios.post(`${API_BASE_URL}/api/dashboard/update-receiptstatus`, { houseno, name });
      fetchDashboardData();
    } catch {
      alert('Failed to change status!');
    }
  };



  const filteredReceipts = receipts.filter((r) => {
    const house = (r.houseno || "").toLowerCase();
    const filterH = filterHouse.toLowerCase();

    // ✅ HOUSE FILTER
    const matchHouse = filterH ? house.includes(filterH) : true;

    // ✅ DATE FILTER (FIXED)
    const receiptDate = r.created_at
      ? new Date(r.created_at).toLocaleDateString("en-CA") // YYYY-MM-DD format
      : "";

    const matchDate = filterDate ? receiptDate === filterDate : true;

    return matchHouse && matchDate;
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

      {/* CHARTS */}
      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* CARD */}
        <div className="group glass-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-glow-violet">
          <h4 className="mb-1 text-center text-sm font-semibold uppercase tracking-widest text-slate-500">
            Customers Status
          </h4>
          <PremiumDonut data={statusData} gradientPrefix="status" />
        </div>

        <div className="group glass-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-glow-violet">
          <h4 className="mb-1 text-center text-sm font-semibold uppercase tracking-widest text-slate-500">
            Payment Modes
          </h4>
          <PremiumDonut data={modeData} gradientPrefix="mode" />
        </div>

        <div className="group glass-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-glow-violet">
          <h4 className="mb-1 text-center text-sm font-semibold uppercase tracking-widest text-slate-500">
            Receipt Status
          </h4>
          <PremiumDonut data={receiptStatusData} gradientPrefix="receipt" />
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
          <div className="p-5 pt-0 animate-fadeIn">

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left">

                <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white uppercase text-xs tracking-wider">
                  <tr>
                    <th className="p-3">House</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Block</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>

                <tbody className="text-slate-700">
                  {dueHouseList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center p-4 text-slate-500">No due records</td>
                    </tr>
                  ) : (
                    dueHouseList.map(row => (
                      <tr key={row.houseno} className="border-b border-slate-100 transition hover:bg-blue-50/60">
                        <td className="p-3 font-medium text-slate-900">{row.houseno}</td>
                        <td className="p-3">{row.name}</td>
                        <td className="p-3">{row.block}</td>
                        <td className="p-3 text-blue-600 font-semibold">₹ {row.amount}</td>
                        <td className="p-3">
                          <button
                            className="btn-neon !px-4 !py-1.5 text-xs"
                            onClick={() => handleChangeStatus(row.houseno)}
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

      {/* FILTERS */}
      {/* ================= PREMIUM FILTER ================= */}
      <div className="mt-6 glass-card p-5">

        <div className="flex flex-col md:flex-row gap-4 items-center">

          {/* HOUSE FILTER */}
          <div className="w-full md:w-1/3 relative">
            <input
              type="text"
              placeholder="🔍 Search by House No"
              value={filterHouse}
              onChange={(e) => setFilterHouse(e.target.value)}
              className="input-neon"
            />
          </div>

          {/* DATE FILTER */}
          <div className="w-full md:w-1/3 relative">

  {/* DATE INPUT */}
  <input
    type="date"
    value={filterDate}
    onChange={(e) => setFilterDate(e.target.value)}
    className="input-neon pr-10 cursor-pointer"
  />

  {/* CUSTOM ICON */}
  <FiCalendar
    className="absolute right-3 top-1/2 -translate-y-1/2 
               text-blue-500 text-lg pointer-events-none"
  />

</div>

          {/* RESET BUTTON */}
          <div className="w-full md:w-auto flex gap-2">

            <button
              onClick={() => {
                setFilterHouse("");
                setFilterDate("");
              }}
              className="btn-ghost w-full md:w-auto"
            >
              Reset
            </button>

          </div>

        </div>

        {/* RESULT COUNT */}
        <div className="mt-4 text-sm text-slate-500">
          Showing <b className="text-blue-600">{filteredReceipts.length}</b> result(s)
        </div>

      </div>

      {/* RECEIPTS */}
      {/* ================= RECEIPTS (COLLAPSIBLE) ================= */}
      <div className="mt-6 glass-card overflow-hidden">

        {/* HEADER */}
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

        {/* CONTENT */}
        {showReceipts && (
          <div className="p-5 pt-0 animate-fadeIn">

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">

                <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white uppercase text-xs tracking-wider text-left">
                  <tr>
                    <th className="p-3">Receipt</th>
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
                      <td colSpan={6} className="text-center p-4 text-slate-500">
                        No receipts found
                      </td>
                    </tr>
                  ) : (
                    filteredReceipts.map((r, index) => (
                      <tr key={index} className="border-b border-slate-100 transition hover:bg-blue-50/60">
                        <td className="p-3 font-medium text-slate-900">{r.receipt_no}</td>
                        <td className="p-3">{r.houseno}</td>
                        <td className="p-3">{r.name}</td>
                        <td className="p-3 text-blue-600 font-semibold">₹ {r.amount}</td>
                        <td className="p-3">
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <button
                            className="btn-neon !px-4 !py-1.5 text-xs"
                            onClick={() => {
                              setSelectedReceipt(r);
                              setShowReceiptModal(true);
                            }}
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl p-4 overflow-auto max-h-[90vh]">

            <h3 className="text-center font-bold mb-4">Receipt</h3>

            {showReceiptModal && selectedReceipt && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-2 py-4">

                <div className="bg-white w-full max-w-xl rounded-2xl shadow-[0_20px_60px_-10px_rgba(37,99,235,0.4)] ring-1 ring-blue-200 overflow-hidden animate-fadeIn">

                  {/* Prefer stored Supabase receipt image when available */}
                  {selectedReceipt.receipt_image_url ? (
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
                          {selectedReceipt.amount} only
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

                    {/* SIGNATURES */}
                    <div className="grid grid-cols-3 text-center mt-6 text-xs gap-2">

                      <div>
                        <p className="font-bold">{config?.president || "Sarbani Basu Roy"}</p>
                        <p className="italic">President</p>
                      </div>

                      <div>
                        <p className="font-bold">{config?.secretary1}</p>
                        <p className="font-bold">{config?.secretary2}</p>
                        <p className="italic">Jt. Secretaries</p>
                      </div>

                      <div>
                        <p className="font-bold">{config?.treasurer || "Sayan Mitra"}</p>
                        <p className="italic">Treasurer</p>
                      </div>

                    </div>

                  </div>
                  )}

                  {/* BUTTON */}
                  <div className="p-4 bg-slate-50">
                    <button
                      className="btn-neon w-full"
                      onClick={() => setShowReceiptModal(false)}
                    >
                      Close
                    </button>
                  </div>

                </div>

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

export default Home;