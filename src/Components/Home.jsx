import React, { useEffect, useState,useCallback } from 'react';
import axios from 'axios';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import './Home.css';
import { API_BASE_URL } from './Constants.jsx';

const COLORS = [
  '#0088FE', '#00C49F', '#FF8042', '#FFBB28',
  '#A28CFE', '#FF4F81', '#50C9CE', '#4caf50', '#ff3d00'
];

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

 

  const filteredReceipts = receipts.filter(r => {

    const matchHouse = filterHouse
      ? r.houseno?.toLowerCase().includes(filterHouse.toLowerCase())
      : true;

    const matchDate = filterDate
      ? new Date(r.created_at).toISOString().split("T")[0] === filterDate
      : true;

    return matchHouse && matchDate;
  });

  return (

    <div className="home">

      {/* Animated gradient blobs */}
      <div className="dashboard-bg">
        <div className="blob blob1"></div>
        <div className="blob blob2"></div>
        <div className="blob blob3"></div>
      </div>

      <h2>Dashboard Overview</h2>

      <div className="chart-row">

        <div className="chart-box">
          <h4>Customers Status</h4>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {statusData.map((entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-box">
          <h4>Payment Modes for all blocks</h4>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={modeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {modeData.map((entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-box">
          <h4>Filed Based on Receipt Status</h4>

          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={receiptStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {receiptStatusData.map((entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>

          <h5 className="due-title">
            House Numbers with Due Receipt Status
          </h5>

          <div className="due-table">
            <table>
              <thead>
                <tr>
                  <th>House No</th>
                  <th>Name</th>
                  <th>Block</th>
                  <th>Amount</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {dueHouseList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="no-data">
                      No due records!
                    </td>
                  </tr>
                ) : dueHouseList.map(row => (
                  <tr key={row.houseno}>
                    <td>{row.houseno}</td>
                    <td>{row.name}</td>
                    <td>{row.block}</td>
                    <td>{row.amount}</td>
                    <td>
                      <button
                        className="blue-btn"
                        onClick={() => handleChangeStatus(row.houseno, row.name)}
                      >
                        Change Status to Completed
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          </div>

        </div>

      </div>

      <div className="receipt-filters" style={{
        display: "flex",
        gap: "15px",
        marginBottom: "15px",
        flexWrap: "wrap"
      }}>

        <input
          type="text"
          placeholder="Filter by House No"
          value={filterHouse}
          onChange={(e) => setFilterHouse(e.target.value)}
          style={{ padding: "8px", borderRadius: "5px", border: "1px solid #ccc" }}
        />

        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          style={{ padding: "8px", borderRadius: "5px", border: "1px solid #ccc" }}
        />

        <button
          className="blue-btn"
          onClick={() => {
            setFilterHouse("");
            setFilterDate("");
          }}
        >
          Reset
        </button>

      </div>
      <div className="receipt-section">
        <h3>📄 Generated Receipts</h3>

        <div className="receipt-table">
          <table>
            <thead>
              <tr>
                <th>Receipt No</th>
                <th>House No</th>
                <th>Name</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="no-data">No receipts found</td>
                </tr>
              ) : (
                filteredReceipts.map((r, index) => (
                  <tr key={index}>
                    <td>{r.receipt_no}</td>
                    <td>{r.houseno}</td>
                    <td>{r.name}</td>
                    <td>₹ {r.amount}</td>
                    <td>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="blue-btn"
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
      {showReceiptModal && selectedReceipt && (
  <div className="modal-overlay">
    <div className="modal-content receipt-modal">

      {/* NEW WRAPPER FIX */}
    {showReceiptModal && selectedReceipt && (
  <div className="modal-overlay">
    <div className="modal-content receipt-modal" style={{ maxWidth: 850, padding: 0 }}>

      <div style={{
        border: '2px dashed #0033cc',
        margin: 20,
        padding: 18,
        fontFamily: "Georgia, Times New Roman, serif",
        background: '#fff',
        color: '#0033cc'
      }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <b>No.</b> <span style={{ fontWeight: 700 }}>{selectedReceipt.receipt_no}</span>
          </div>
          <div>
            <b>Date:</b>{" "}
            <span style={{ fontWeight: 700, color: '#222' }}>
              {new Date(selectedReceipt.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* TITLE */}
        <div style={{
          fontSize: '1.5em',
          fontWeight: 700,
          textAlign: 'center',
          margin: '8px 0'
        }}>
          Sarbojanin Durgotsab, 2026
        </div>

        {/* ORG */}
        <div style={{ textAlign: 'center', color: '#222' }}>
          Organised by : <br />
          <b style={{ color: '#0033cc' }}>
            SARBOJANIN DURGOTSAB COMMITTEE, LAKE GARDENS
          </b><br />
          <b>Lake Gardens People’s Association</b><br />
          <span style={{ color: '#0033cc' }}>
            At Bangur Park, B-202 Lake Gardens, Kolkata - 700 045
          </span>
        </div>

        <hr style={{ borderTop: '1.5px solid #0033cc', margin: '12px 0' }} />

        {/* BODY */}
        <div style={{ fontStyle: 'italic' }}>
          Received with thanks from <b style={{ color: '#333' }}>{selectedReceipt.name}</b>
        </div>

        <div style={{ fontStyle: 'italic' }}>
          of <b style={{ color: '#333' }}>{selectedReceipt.houseno}</b>
        </div>

        <div style={{ fontStyle: 'italic' }}>
          The sum of Rupees <b style={{ color: '#333' }}>
            {selectedReceipt.amount} only
          </b>
        </div>

        <div>
          by <b style={{ color: '#333' }}>{selectedReceipt.payment_mode || "Cash"}</b>
        </div>

        <div style={{ fontStyle: 'italic' }}>
          as subscription/donation for Sri Sri Durga Puja, Laxmi Puja and Kali Puja 2026.
        </div>

        {/* AMOUNT BOX */}
        <div style={{
          border: '2px solid #0033cc',
          borderRadius: 7,
          width: 120,
          padding: '5px 0',
          fontSize: '1.25em',
          fontWeight: 'bold',
          margin: '10px 0',
          textAlign: 'center'
        }}>
          ₹ {selectedReceipt.amount}
        </div>

        {/* ✅ DYNAMIC SIGNATURES */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 30
        }}>
          <div style={{ textAlign: 'center' }}>
            <b>{config.president || "Sarbani Basu Roy"}</b><br />
            <i>President</i>
          </div>

          <div style={{ textAlign: 'center' }}>
            <b>{config.secretary1 || "Moumita Shome"}</b><br />
            <b>{config.secretary2 || "Ragesri Choudhury"}</b><br />
            <i>Jt. General Secretaries</i>
          </div>

          <div style={{ textAlign: 'center' }}>
            <b>{config.treasurer || "Sayan Mitra"}</b><br />
            <i>Treasurer</i>
          </div>
        </div>

      </div>

      {/* CLOSE BUTTON */}
      <div className="modal-footer">
        <button
          className="blue-btn"
          onClick={() => setShowReceiptModal(false)}
        >
          Close
        </button>
      </div>

    </div>
  </div>
)}

      <div className="modal-footer">
        <button
          className="blue-btn"
          onClick={() => setShowReceiptModal(false)}
        >
          Close
        </button>
      </div>

    </div>
  </div>
)}
    </div>
  );
}

export default Home;