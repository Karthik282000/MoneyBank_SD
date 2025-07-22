import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './SearchPeople.css';

function SearchPeople({ allowedBlocks }) {
  const [houseNo, setHouseNo] = useState('');
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [selectedBlock, setSelectedBlock] = useState('');
  const [allData, setAllData] = useState([]);
  const [filteredData, setFilteredData] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [searchBy, setSearchBy] = useState('');
  const [blockFilterResults, setBlockFilterResults] = useState([]);
  const [totalBlockAmount, setTotalBlockAmount] = useState(0);
  const [availableBlocks, setAvailableBlocks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const dropdownRef = useRef(null);

  // Parse allowedBlocks
  useEffect(() => {
    if (Array.isArray(allowedBlocks)) {
      setAvailableBlocks(allowedBlocks);
    } else if (typeof allowedBlocks === 'string') {
      try {
        const parsed = JSON.parse(allowedBlocks);
        if (Array.isArray(parsed)) setAvailableBlocks(parsed);
        else setAvailableBlocks([allowedBlocks]);
      } catch {
        const cleaned = allowedBlocks.replace(/[{}"]/g, '');
        setAvailableBlocks(cleaned.split(',').map(x => x.trim()).filter(Boolean));
      }
    } else {
      setAvailableBlocks([]);
    }
  }, [allowedBlocks]);

  useEffect(() => {
    fetchAllData();
  }, [allowedBlocks]);

  const fetchAllData = async () => {
    try {
      const response = await axios.post('https://moneybank-sd.onrender.com/api/all-data', {
        allowedBlocks: allowedBlocks || []
      });
      setAllData(response.data);
    } catch (error) {
      console.error('Error fetching all data:', error);
    }
  };

  // Dropdown show options logic with modal on empty result
  const handleButtonClick = (field) => {
    const value = (field === 'houseNo' ? houseNo : name).trim().toLowerCase();
    setSearchBy(field);

    if (value) {
      let filtered = allData.filter(item =>
        field === 'houseNo'
          ? item.houseno?.toLowerCase().startsWith(value)
          : item.name?.toLowerCase().startsWith(value)
      );

      // Deduplicate by houseno
      const seen = new Set();
      filtered = filtered.filter(item => {
        if (seen.has(item.houseno)) return false;
        seen.add(item.houseno);
        return true;
      });

      setFilteredSuggestions(filtered);
      setShowDropdown(filtered.length > 0);

      // Show modal if no suggestion found
      if (filtered.length === 0) setShowModal(true);
    } else {
      setFilteredSuggestions([]);
      setShowDropdown(false);
    }
  };

  const handleSelectSuggestion = (suggestion) => {
    setHouseNo(suggestion.houseno || '');
    setName(suggestion.name || '');
    setShowDropdown(false);
  };

  const handleFilter = () => {
    let data = [...allData];

    if (houseNo) {
      data = data.filter(d => d.houseno.toLowerCase() === houseNo.toLowerCase());
    }
    if (name) {
      data = data.filter(d => d.name.toLowerCase().includes(name.toLowerCase()));
    }
    if (year) {
      const yearInt = parseInt(year);
      data = data.filter(d => {
        const txYear = new Date(d.yearofpayment).getFullYear();
        return txYear === yearInt;
      });
    }

    // Group by houseno+name+year for multiple persons per house
    const groupMap = {};
    data.forEach(item => {
      const txYear = new Date(item.yearofpayment).getFullYear();
      const key = `${item.houseno}||${item.name}||${txYear}`;
      if (!groupMap[key]) {
        groupMap[key] = {
          houseno: item.houseno,
          name: item.name,
          contact: item.contact,
          year: txYear,
          totalAmount: 0,
          amountPaidLastYear: item.amountpaidlastyear || 0
        };
      }
      groupMap[key].totalAmount += parseFloat(item.subscriptionamount || 0);
    });

    setFilteredData(Object.values(groupMap));
    setBlockFilterResults([]);
    setTotalBlockAmount(0);
  };

  const handleApplyBlockFilter = () => {
    if (!selectedBlock) return;
    const filtered = allData.filter(item =>
      item.block === selectedBlock
    );
    const total = filtered.reduce((sum, item) => sum + (parseFloat(item.subscriptionamount || 0)), 0);
    setBlockFilterResults(filtered);
    setTotalBlockAmount(total);
    setFilteredData(null);
  };

  const resetFilters = () => {
    setHouseNo('');
    setName('');
    setYear('');
    setSelectedBlock('');
    setFilteredData(null);
    setFilteredSuggestions([]);
    setShowDropdown(false);
    setBlockFilterResults([]);
    setTotalBlockAmount(0);
  };

  // Close modal handler
  const closeModal = () => setShowModal(false);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = event => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="search-people">
      <h1>Search Subscriptions</h1>

      <div style={{ position: "relative" }}>
        <label>House No:</label>
        <input
          type="text"
          value={houseNo}
          onChange={e => setHouseNo(e.target.value)}
        />
        <button type="button" onClick={() => handleButtonClick('houseNo')}>Show Options</button>
      </div>

      <div>
        <label>Name:</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <button type="button" onClick={() => handleButtonClick('name')}>Show Options</button>
      </div>

      {showDropdown && filteredSuggestions.length > 0 && (
        <ul className="suggestions-dropdown" ref={dropdownRef}>
          {filteredSuggestions.map((suggestion, index) => (
            <li key={index} onClick={() => handleSelectSuggestion(suggestion)}>
              {suggestion.houseno} - {suggestion.name} - {suggestion.contact}
            </li>
          ))}
        </ul>
      )}

      {/* Year filter (uncomment if needed) */}
      {/* <div>
        <label>Year:</label>
        <input
          type="number"
          placeholder="e.g. 2025"
          value={year}
          onChange={e => setYear(e.target.value)}
        />
      </div> */}

      <div>
        <label>Block:</label>
        <select value={selectedBlock} onChange={e => setSelectedBlock(e.target.value)}>
          <option value="">Select Block</option>
          {Array.isArray(availableBlocks) && availableBlocks.map((block, index) => (
            <option key={index} value={block}>{block}</option>
          ))}
        </select>
        <button onClick={handleApplyBlockFilter} style={{ marginLeft: '10px' }}>Apply Block Filter</button>
      </div>

      <div style={{ marginTop: '10px' }}>
        <button onClick={handleFilter}>Apply All Filters</button>
        <button onClick={resetFilters} style={{ marginLeft: '10px' }}>
          Reset Filters
        </button>
      </div>

      {/* Filtered Data Table */}
      {filteredData && filteredData.length > 0 && (
        <>
          <h3 style={{ marginTop: '20px' }}>Filtered Result:</h3>
          <table>
            <thead>
              <tr>
                <th>House No</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Year</th>
                <th>Amount Paid Last Year</th>
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
                  <td>{item.amountPaidLastYear}</td>
                  <td>{item.totalAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Block Filter Table */}
      {blockFilterResults.length > 0 && (
        <>
          <h3 style={{ marginTop: '20px' }}>
            Total Subscription for Block {selectedBlock}: ₹{totalBlockAmount.toFixed(2)}
          </h3>
          <table>
            <thead>
              <tr>
                <th>House No</th>
                <th>Name</th>
                <th>Subscription Total Amount</th>
                <th>Date and time of transaction</th>
              </tr>
            </thead>
            <tbody>
              {blockFilterResults.map((item, index) => (
                <tr key={index}>
                  <td>{item.houseno}</td>
                  <td>{item.name}</td>
                  <td>{item.subscriptionamount}</td>
                  <td>
                    {item.transaction_timestamp
                      ? item.transaction_timestamp.split('T')[0]
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Modal for no houseNo/name found */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <p>No house number found.</p>
            <button onClick={closeModal}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchPeople;
