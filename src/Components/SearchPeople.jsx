import React, { useState, useEffect, useRef ,useCallback} from 'react';
import axios from 'axios';
import './SearchPeople.css';
import { API_BASE_URL } from './Constants.jsx';

function SearchPeople({ allowedBlocks }) {
  const [houseNo, setHouseNo] = useState('');
  const [name, setName] = useState(''); 
  const [year, setYear] = useState('');
  const [selectedBlock, setSelectedBlock] = useState('');
  const [receiptStatus, setReceiptStatus] = useState(''); // NEW STATE
  const [allData, setAllData] = useState([]);
  const [filteredData, setFilteredData] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  // const [searchBy, setSearchBy] = useState('');
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

  

  const fetchAllData = useCallback(async () => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/all-data`, {
      allowedBlocks: allowedBlocks || [],
      receiptStatus: receiptStatus
    });
    setAllData(response.data);
  } catch (error) {
    console.error('Error fetching all data:', error);
  }
}, [allowedBlocks, receiptStatus]);  


useEffect(() => {
  fetchAllData();
}, [fetchAllData]);

  // Dropdown show options logic with modal on empty result
  const handleButtonClick = (field) => {
    const value = (field === 'houseNo' ? houseNo : name).trim().toLowerCase();
    // setSearchBy(field);

    if (value) {
      let filtered = allData.filter(item =>
        field === 'houseNo'
          ? item.houseno?.toLowerCase().startsWith(value)
          : item.name?.toLowerCase().startsWith(value)
      );

      // Deduplicate by houseno
      // const seen = new Set();
      // filtered = filtered.filter(item => {
      //   if (seen.has(item.houseno)) return false;
      //   seen.add(item.houseno);
      //   return true;
      // });

           const seen = new Set();
    filtered = filtered.filter(item => {
      const key = `${item.houseno}||${item.name}`;  // Unique by houseNo and name
      if (seen.has(key)) return false;
      seen.add(key);
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

  // If filtering for "Due", only include (houseNo, name) pairs where ANY transaction is due
  if (receiptStatus) {
    data = data.filter(
      d => (d.receiptstatus || '').toLowerCase() === receiptStatus
    );
  }

  // Group by houseno+name to only show unique pairs (sum amount if you want)
  const groupMap = {};
  data.forEach(item => {
    const key = `${item.houseno}||${item.name}`;
    if (!groupMap[key]) {
      groupMap[key] = {
        houseno: item.houseno,
        name: item.name,
        contact: item.contact,
        // You can aggregate fields as needed
        year: item.yearofpayment ? new Date(item.yearofpayment).getFullYear() : '',
        totalAmount: 0,
        amountPaidLastYear: item.amountpaidlastyear || 0,
        receiptStatus: (item.receiptstatus || '')
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
    setReceiptStatus('');
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
    <div className="relative w-full min-h-full p-4 md:p-8 overflow-hidden">

      {/* Ambient animated glow blobs */}
      <div className="pointer-events-none absolute -top-24 left-10 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl animate-floatBlob" />
      <div className="pointer-events-none absolute bottom-0 -right-24 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl animate-floatBlob" style={{ animationDelay: '4s' }} />

      <div className="relative mb-8 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-blue-500/80">Records</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight neon-text">Search Subscriptions</h1>
        <div className="mx-auto mt-4 h-[2px] w-40 rounded-full bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
      </div>

      <div className="relative glass-card p-5 md:p-8 space-y-5">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* House No */}
          <div className="relative">
            <label className="block text-slate-700 font-semibold mb-2">House No:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={houseNo}
                onChange={e => setHouseNo(e.target.value)}
                className="input-neon"
              />
              <button type="button" onClick={() => handleButtonClick('houseNo')} className="btn-neon whitespace-nowrap !px-4 text-sm">Show Options</button>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-slate-700 font-semibold mb-2">Name:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="input-neon"
              />
              <button type="button" onClick={() => handleButtonClick('name')} className="btn-neon whitespace-nowrap !px-4 text-sm">Show Options</button>
            </div>
          </div>

        </div>

        {showDropdown && filteredSuggestions.length > 0 && (
          <ul
            ref={dropdownRef}
            className="bg-white border border-slate-200 rounded-2xl shadow-neon max-h-64 overflow-y-auto divide-y divide-slate-100"
          >
            {filteredSuggestions.map((suggestion, index) => (
              <li
                key={index}
                onClick={() => handleSelectSuggestion(suggestion)}
                className="px-4 py-3 cursor-pointer transition hover:bg-blue-50 text-slate-700"
              >
                {suggestion.houseno} - {suggestion.name} - {suggestion.contact}
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Receipt Status */}
          <div>
            <label className="block text-slate-700 font-semibold mb-2">Receipt Status:</label>
            <select
              value={receiptStatus}
              onChange={e => setReceiptStatus(e.target.value)}
              className="input-neon"
            >
              <option value="">All</option>
              <option value="collected">Collected</option>
              <option value="due">Due</option>
            </select>
          </div>

          {/* Uncomment this block if year filter is needed */}
          {/* <div>
            <label>Year:</label>
            <input
              type="number"
              placeholder="e.g. 2025"
              value={year}
              onChange={e => setYear(e.target.value)}
            />
          </div> */}

          {/* Block */}
          <div>
            <label className="block text-slate-700 font-semibold mb-2">Block:</label>
            <div className="flex gap-2">
              <select value={selectedBlock} onChange={e => setSelectedBlock(e.target.value)} className="input-neon">
                <option value="">Select Block</option>
                {Array.isArray(availableBlocks) && availableBlocks.map((block, index) => (
                  <option key={index} value={block}>{block}</option>
                ))}
              </select>
              <button onClick={handleApplyBlockFilter} className="btn-neon whitespace-nowrap !px-4 text-sm">Apply Block Filter</button>
            </div>
          </div>

        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button onClick={handleFilter} className="btn-neon">Apply All Filters</button>
          <button onClick={resetFilters} className="btn-ghost">
            Reset Filters
          </button>
        </div>
      </div>

      {/* Filtered Data Table */}
      {filteredData && filteredData.length > 0 && (
        <div className="relative mt-6 glass-card overflow-hidden">
          <h3 className="p-5 pb-3 text-lg font-semibold text-slate-800">Filtered Result:</h3>
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full text-sm text-left border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white uppercase text-xs tracking-wider">
                <tr>
                  <th className="p-3">House No</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Year</th>
                  <th className="p-3">Amount Paid Last Year</th>
                  <th className="p-3">Total Amount Paid</th>
                  <th className="p-3">Receipt Status</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {filteredData.map((item, index) => (
                  <tr key={index} className="border-b border-slate-100 transition hover:bg-blue-50/60">
                    <td className="p-3 font-medium text-slate-900">{item.houseno}</td>
                    <td className="p-3">{item.name}</td>
                    <td className="p-3">{item.contact}</td>
                    <td className="p-3">{item.year}</td>
                    <td className="p-3">{item.amountPaidLastYear}</td>
                    <td className="p-3 text-blue-600 font-semibold">{item.totalAmount.toFixed(2)}</td>
                    <td className="p-3 font-semibold" style={{ color: item.receiptStatus === 'due' ? '#f87171' : '#34d399' }}>
                      {item.receiptStatus ? item.receiptStatus.charAt(0).toUpperCase() + item.receiptStatus.slice(1) : 'Collected'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Block Filter Table */}
      {blockFilterResults.length > 0 && (
        <div className="relative mt-6 glass-card overflow-hidden">
          <h3 className="p-5 pb-3 text-lg font-semibold text-slate-800">
            Total Subscription for Block {selectedBlock}: <span className="neon-text">₹{totalBlockAmount.toFixed(2)}</span>
          </h3>
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full text-sm text-left border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white uppercase text-xs tracking-wider">
                <tr>
                  <th className="p-3">House No</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Subscription Total Amount</th>
                  <th className="p-3">Date and time of transaction</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {blockFilterResults.map((item, index) => (
                  <tr key={index} className="border-b border-slate-100 transition hover:bg-blue-50/60">
                    <td className="p-3 font-medium text-slate-900">{item.houseno}</td>
                    <td className="p-3">{item.name}</td>
                    <td className="p-3 text-blue-600 font-semibold">{item.subscriptionamount}</td>
                    <td className="p-3">
                      {item.transaction_timestamp
                        ? item.transaction_timestamp.split('T')[0]
                        : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for no houseNo/name found */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm glass-card p-6 text-center animate-fadeIn">
            <p className="text-slate-700 mb-5">No house number found.</p>
            <button onClick={closeModal} className="btn-neon w-full">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchPeople;
