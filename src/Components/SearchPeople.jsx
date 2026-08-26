import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import './SearchPeople.css';
import { API_BASE_URL } from './Constants.jsx';

function SearchPeople({ allowedBlocks }) {
  const [houseNo, setHouseNo] = useState('');
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [selectedBlock, setSelectedBlock] = useState('');
  const [receiptStatus, setReceiptStatus] = useState('');
  const [allData, setAllData] = useState([]);
  const [filteredData, setFilteredData] = useState(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [availableBlocks, setAvailableBlocks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const dropdownRef = useRef(null);

  // Parse allowedBlocks (may be an array or a stringified/Postgres array)
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

  const isAllAccess = Array.isArray(availableBlocks) && availableBlocks.includes('ALLBLOCKS');

  // Block options: all-access users pick from the real blocks present in the data;
  // restricted users only see their own permitted blocks.
  const blockOptions = useMemo(() => {
    if (isAllAccess) {
      const distinct = Array.from(
        new Set(allData.map(d => d.block).filter(Boolean))
      );
      return distinct.sort();
    }
    return (availableBlocks || []).filter(b => b !== 'ALLBLOCKS');
  }, [isAllAccess, allData, availableBlocks]);

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

  // Live autocomplete as the user types in House No or Name
  const updateSuggestions = (field, value) => {
    const v = value.trim().toLowerCase();
    if (!v) {
      setFilteredSuggestions([]);
      setShowDropdown(false);
      return;
    }
    let filtered = allData.filter(item =>
      field === 'houseNo'
        ? item.houseno?.toLowerCase().startsWith(v)
        : item.name?.toLowerCase().startsWith(v)
    );
    const seen = new Set();
    filtered = filtered.filter(item => {
      const key = `${item.houseno}||${item.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setFilteredSuggestions(filtered);
    setShowDropdown(filtered.length > 0);
  };

  const handleHouseNoChange = (value) => {
    setHouseNo(value);
    updateSuggestions('houseNo', value);
  };

  const handleNameChange = (value) => {
    setName(value);
    updateSuggestions('name', value);
  };

  const handleSelectSuggestion = (suggestion) => {
    setHouseNo(suggestion.houseno || '');
    setName(suggestion.name || '');
    setShowDropdown(false);
  };

  // Single unified filter — House No + Name + Year + Receipt Status + Block
  const handleSearch = () => {
    let data = [...allData];

    if (houseNo) {
      data = data.filter(d => (d.houseno || '').toLowerCase().includes(houseNo.toLowerCase()));
    }
    if (name) {
      data = data.filter(d => (d.name || '').toLowerCase().includes(name.toLowerCase()));
    }
    if (selectedBlock) {
      data = data.filter(d => d.block === selectedBlock);
    }
    if (year) {
      const yearInt = parseInt(year);
      data = data.filter(d => {
        if (!d.yearofpayment) return false;
        const txYear = new Date(d.yearofpayment).getFullYear();
        return txYear === yearInt;
      });
    }
    if (receiptStatus) {
      data = data.filter(d => {
        const rs = (d.receiptstatus || '').toLowerCase();
        return receiptStatus === 'collected'
          ? (rs === 'collected' || rs === 'completed')
          : rs === receiptStatus;
      });
    }

    // Group by houseno + name (sum the amounts)
    const groupMap = {};
    data.forEach(item => {
      const key = `${item.houseno}||${item.name}`;
      if (!groupMap[key]) {
        groupMap[key] = {
          houseno: item.houseno,
          name: item.name,
          contact: item.contact,
          block: item.block,
          year: item.yearofpayment ? new Date(item.yearofpayment).getFullYear() : '',
          totalAmount: 0,
          amountPaidLastYear: item.amountpaidlastyear || 0,
          receiptStatus: (item.receiptstatus || '')
        };
      }
      groupMap[key].totalAmount += parseFloat(item.subscriptionamount || 0);
    });

    const results = Object.values(groupMap);
    setFilteredData(results);
    setTotalAmount(results.reduce((sum, r) => sum + r.totalAmount, 0));
    setShowDropdown(false);

    if (results.length === 0) setShowModal(true);
  };

  const resetFilters = () => {
    setHouseNo('');
    setName('');
    setYear('');
    setSelectedBlock('');
    setReceiptStatus('');
    setFilteredData(null);
    setTotalAmount(0);
    setFilteredSuggestions([]);
    setShowDropdown(false);
  };

  const closeModal = () => setShowModal(false);

  // Click outside to close the suggestions dropdown
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
            <input
              type="text"
              value={houseNo}
              onChange={e => handleHouseNoChange(e.target.value)}
              className="input-neon"
              placeholder="Type to search…"
            />
          </div>

          {/* Name */}
          <div className="relative">
            <label className="block text-slate-700 font-semibold mb-2">Name:</label>
            <input
              type="text"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              className="input-neon"
              placeholder="Type to search…"
            />
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

          {/* Block */}
          <div>
            <label className="block text-slate-700 font-semibold mb-2">Block:</label>
            <select value={selectedBlock} onChange={e => setSelectedBlock(e.target.value)} className="input-neon">
              <option value="">All Blocks</option>
              {blockOptions.map((block, index) => (
                <option key={index} value={block}>{block}</option>
              ))}
            </select>
          </div>

        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button onClick={handleSearch} className="btn-neon">Search</button>
          <button onClick={resetFilters} className="btn-ghost">Reset</button>
        </div>
      </div>

      {/* Filtered Data Table */}
      {filteredData && filteredData.length > 0 && (
        <div className="relative mt-6 glass-card overflow-hidden">
          <h3 className="p-5 pb-3 text-lg font-semibold text-slate-800">
            Result{selectedBlock ? ` — Block ${selectedBlock}` : ''}: <span className="neon-text">₹{totalAmount.toFixed(2)}</span>
          </h3>
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full text-sm text-left border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white uppercase text-xs tracking-wider">
                <tr>
                  <th className="p-3">House No</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Block</th>
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
                    <td className="p-3">{item.block}</td>
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

      {/* Modal for no result found */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm glass-card p-6 text-center animate-fadeIn">
            <p className="text-slate-700 mb-5">No matching records found.</p>
            <button onClick={closeModal} className="btn-neon w-full">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchPeople;
