import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SearchPeople.css';

function SearchPeople() {
  const [houseNo, setHouseNo] = useState('');
  const [name, setName] = useState('');
  const [dateOfTransaction, setDateOfTransaction] = useState('');
  const [year, setYear] = useState('');
  const [subscribers, setSubscribers] = useState([]);
  const [allData, setAllData] = useState([]);
  const [filteredData, setFilteredData] = useState(null);

  useEffect(() => {
    fetchSubscribers();
    fetchAllData();
  }, []);

  const fetchSubscribers = async () => {
    try {
      const response = await axios.get('https://moneybank-sd.onrender.com/api/subscribers');
      setSubscribers(response.data);
    } catch (error) {
      console.error('Error fetching subscribers:', error);
    }
  };

  const fetchAllData = async () => {
    try {
      const response = await axios.get('https://moneybank-sd.onrender.com/api/all-data');
      setAllData(response.data);
    } catch (error) {
      console.error('Error fetching all data:', error);
    }
  };

  const handleFilter = () => {
    if (!houseNo && !name && !dateOfTransaction && !year) {
      alert('Please enter at least one filter to search!');
      setFilteredData(null);
      return;
    }
  
    let data = [...allData];
  
    if (!houseNo && !name && !dateOfTransaction && year) {
      const yearInt = parseInt(year);
      const resultMap = {};
  
      data.forEach(d => {
        const txDate = new Date(d.yearofpayment);
        const txYear = txDate.getFullYear();
        if (txYear === yearInt) {
          const key = `${d.houseno}-${txYear}`;
          if (!resultMap[key]) {
            resultMap[key] = {
              houseno: d.houseno,
              name: d.name,
              contact: d.contact,
              year: txYear,
              totalAmount: 0
            };
          }
          resultMap[key].totalAmount += parseFloat(d.subscriptionamount || 0);
        }
      });
  
      setFilteredData(Object.values(resultMap));
      return;
    }
  
    if (houseNo) {
      data = data.filter(d => d.houseno.toLowerCase() === houseNo.toLowerCase());
    }
    if (name) {
      data = data.filter(d => d.name.toLowerCase().includes(name.toLowerCase()));
    }
    if (dateOfTransaction) {
      const selectedDateStr = new Date(dateOfTransaction).toISOString().split('T')[0];
      data = data.filter(d => {
        
        const txDateStr = new Date(d.yearofpayment).toISOString().split('T')[0];
        return txDateStr === selectedDateStr;
      });
    }
    if (year) {
      const yearInt = parseInt(year);
      data = data.filter(d => {
        const txYear = new Date(d.yearofpayment).getFullYear();
        return txYear === yearInt;
      });
    }
  
    const yearMap = {};
    data.forEach(item => {
      const txYear = new Date(item.yearofpayment).getFullYear();
      const key = `${item.houseno}-${txYear}`;
      if (!yearMap[key]) {
        yearMap[key] = {
          houseno: item.houseno,
          name: item.name,
          contact: item.contact,
          year: txYear,
          totalAmount: 0
        };
      }
      yearMap[key].totalAmount += parseFloat(item.subscriptionamount || 0);
    });
  
    setFilteredData(Object.values(yearMap));
  };;

  const resetFilters = () => {
    setHouseNo('');
    setName('');
    setDateOfTransaction('');
    setYear('');
    setFilteredData(null);
  };

  const downloadCSV = () => {
    if (!filteredData || filteredData.length === 0) {
      alert('No data to download!');
      return;
    }

    const headers = ['House No', 'Name', 'Contact', 'Year', 'Total Amount Paid'];
    const csvRows = [
      headers.join(','),
      ...filteredData.map(row =>
        [row.houseno, row.name, row.contact, row.year, row.totalAmount ? row.totalAmount.toFixed(2) : '0.00'].join(',')
      )
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'filtered_data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="search-people">
      <h1>Search Subscriptions</h1>

      <div>
        <label>Customer (House No):</label>
        <select value={houseNo} onChange={e => setHouseNo(e.target.value)}>
          <option value="">--Select House No--</option>
          {subscribers.map((sub, index) => (
            <option key={index} value={sub.houseno}>
              {sub.houseno} - {sub.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label>Customer Name:</label>
        <input
          type="text"
          placeholder="Enter customer name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      <div>
        <label>Date of Transaction:</label>
        <input
          type="date"
          value={dateOfTransaction}
          onChange={e => setDateOfTransaction(e.target.value)}
        />
      </div>

      <div>
        <label>Year:</label>
        <input
          type="number"
          placeholder="e.g. 2025"
          value={year}
          onChange={e => setYear(e.target.value)}
        />
      </div>

      <div style={{ marginTop: '10px' }}>
        <button onClick={handleFilter}>Apply Filters</button>
        <button onClick={resetFilters} style={{ marginLeft: '10px' }}>
          Reset Filters
        </button>
        <button onClick={downloadCSV} style={{ marginLeft: '10px' }}>
          Download CSV
        </button>
      </div>

      {filteredData && filteredData.length > 0 ? (
        <table style={{ marginTop: '20px' }}>
          <thead>
            <tr>
              <th>House No</th>
              <th>Name</th>
              <th>Contact</th>
              <th>Year</th>
              <th>Total Amount Paid</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr key={index}>
                <td>{item.houseno}</td>
                <td>{item.name}</td>
                <td>{item.contact}</td>
                <td>{item.year}</td>
                <td>{item.totalAmount ? item.totalAmount.toFixed(2) : '0.00'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        (houseNo || name || dateOfTransaction || year) && (
          <p style={{ marginTop: '20px' }}>
            No data found for the selected criteria.
          </p>
        )
      )}
    </div>
  );
}

export default SearchPeople;
