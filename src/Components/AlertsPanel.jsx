import React from "react";
import "./AlertsPanel.css";

function AlertsPanel({ dueHouseList, pendingCustomers }) {

  return (
    <div className="glass-card p-5 space-y-3">

      <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-800">
        <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]" />
        Alerts
      </h3>

      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-amber-700 font-medium">
        Houses Pending : {pendingCustomers}
      </div>

      <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-rose-700 font-medium">
        Due Receipts : {dueHouseList.length}
      </div>

      <h3 className="mt-5 mb-1 text-base font-semibold text-slate-700">Recent Due</h3>

      {dueHouseList.slice(0,5).map(h => (
        <div key={h.houseno} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-4 py-2 text-slate-600 transition hover:bg-blue-50 hover:border-blue-200">
          <span>{h.houseno}</span>
          <span className="text-blue-600 font-semibold">₹{h.amount}</span>
        </div>
      ))}

    </div>
  );
}

export default AlertsPanel;