import React, { useEffect, useState } from 'react';
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

  const fetchReceipts = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/receipts`);
      setReceipts(res.data || []);
    } catch (err) {
      console.error("Failed to fetch receipts", err);
    }
  };

  const fetchDashboardData = () => {

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
  };

  useEffect(() => {
    fetchDashboardData();
    fetchReceipts();
  }, [allowedBlocks]);

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
              {filteredReceipts.length === 0 === 0 ? (
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

            <div dangerouslySetInnerHTML={{ __html: selectedReceipt.receipt_html }} />

            <div style={{
              position: "sticky",
              bottom: 0,
              background: "#fff",
              padding: "15px",
              textAlign: "center",
              borderTop: "1px solid #ddd"
            }}>
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