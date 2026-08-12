import React from "react";
import "./QuickStats.css";

function QuickStats({ statusData = [], dueHouseList = [] }) {

  // Ensure arrays are always defined
  const safeStatus = Array.isArray(statusData) ? statusData : [];
  const safeDue = Array.isArray(dueHouseList) ? dueHouseList : [];

  const totalCustomers = safeStatus.reduce((sum, d) => sum + (d.value || 0), 0);

  const paidCustomers =
    safeStatus.find(d => d.name === "Paid")?.value || 0;

  const pendingCustomers =
    safeStatus.find(d => d.name === "Pending")?.value || 0;

  return (
    <div className="glass-card p-5 space-y-3">

      <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-800">
        <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.7)]" />
        Quick Stats
      </h3>

      <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 transition hover:bg-blue-50 hover:border-blue-200">
        <span className="text-slate-600">Total Houses</span>
        <strong className="text-xl neon-text">{totalCustomers}</strong>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 transition hover:bg-blue-50 hover:border-blue-200">
        <span className="text-slate-600">Paid</span>
        <strong className="text-xl text-emerald-600">{paidCustomers}</strong>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 transition hover:bg-blue-50 hover:border-blue-200">
        <span className="text-slate-600">Pending</span>
        <strong className="text-xl text-amber-600">{pendingCustomers}</strong>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 transition hover:bg-blue-50 hover:border-blue-200">
        <span className="text-slate-600">Due Houses</span>
        <strong className="text-xl text-rose-600">{safeDue.length}</strong>
      </div>

    </div>
  );
}

export default QuickStats;