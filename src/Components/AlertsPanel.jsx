import React from "react";
import "./AlertsPanel.css";

function AlertsPanel({ dueHouseList, pendingCustomers }) {

  return (
    <div className="side-panel">

      <h3>Alerts</h3>

      <div className="alert-card">
        Houses Pending : {pendingCustomers}
      </div>

      <div className="alert-card">
        Due Receipts : {dueHouseList.length}
      </div>

      <h3 style={{marginTop:20}}>Recent Due</h3>

      {dueHouseList.slice(0,5).map(h => (
        <div key={h.houseno} className="recent-item">
          {h.houseno} - ₹{h.amount}
        </div>
      ))}

    </div>
  );
}

export default AlertsPanel;