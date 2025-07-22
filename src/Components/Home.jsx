import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import './Home.css';
import {API_BASE_URL} from './Constants.jsx'

const COLORS = ['#0088FE', '#00C49F', '#FF8042', '#FFBB28', '#A28CFE', '#FF4F81', '#50C9CE'];

function Home({ allowedBlocks = [] }) {
  const [statusData, setStatusData] = useState([]);
  const [modeData, setModeData] = useState([]);

  useEffect(() => {
    // 1. Customer Status
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
        console.error('Customer status fetch error:', err);
      });

    // 2. Payment Modes
    axios.post(`${API_BASE_URL}/api/dashboard/payment-modes`, {
      allowedBlocks: allowedBlocks.length ? allowedBlocks : ['ALLBLOCKS']
    })
      .then(res => {
        setModeData(
          (res.data || []).map((d, i) => ({
            name: d.mode,
            value: Number(d.count)
          }))
        );
      })
      .catch(err => {
        setModeData([]);
        console.error('Payment mode fetch error:', err);
      });

  }, [allowedBlocks]);

  // Unified style for all chart containers
  const chartBoxStyle = {
    width: '420px',
    minWidth: '280px',
    maxWidth: '100%',
    margin: '24px auto',
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 2px 8px #ececec',
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  };

  return (
    <div className="home">
      <h2>Dashboard Overview</h2>
      <div className="chart-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 36, justifyContent: 'center' }}>
        <div className="chart-box" style={chartBoxStyle}>
          <h4>Customers Status</h4>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-status-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-box" style={chartBoxStyle}>
          <h4>Payment Modes for all blocks</h4>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={modeData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label
              >
                {modeData.map((entry, index) => (
                  <Cell key={`cell-mode-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default Home;
