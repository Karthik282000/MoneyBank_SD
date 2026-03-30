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
    <div className="side-panel">

      <h3>Quick Stats</h3>

      <div className="stat-card">
        <span>Total Houses</span>
        <strong>{totalCustomers}</strong>
      </div>

      <div className="stat-card">
        <span>Paid</span>
        <strong>{paidCustomers}</strong>
      </div>

      <div className="stat-card">
        <span>Pending</span>
        <strong>{pendingCustomers}</strong>
      </div>

      <div className="stat-card">
        <span>Due Houses</span>
        <strong>{safeDue.length}</strong>
      </div>

    </div>
  );
}

export default QuickStats;