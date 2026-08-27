import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import './SearchPeople.css';
import { API_BASE_URL } from './Constants.jsx';

function extractYear(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (/^\d{4}$/.test(s)) return parseInt(s, 10);
  const dt = new Date(value);
  if (!Number.isNaN(dt.getTime())) return dt.getFullYear();
  const match = s.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

function hasTxn(row) {
  const v = row?.has_transaction;
  return v === true || v === 't' || v === 'true' || v === 1;
}

function statusLabel(item) {
  if (!hasTxn(item)) return 'No transaction';
  const rs = (item.receiptStatus || '').toLowerCase();
  if (rs === 'due') return 'Due';
  if (rs === 'completed' || rs === 'collected') return 'Collected';
  return rs ? rs.charAt(0).toUpperCase() + rs.slice(1) : 'Collected';
}

function statusTone(item) {
  if (!hasTxn(item)) return 'bg-slate-100 text-slate-600 ring-slate-200';
  const rs = (item.receiptStatus || '').toLowerCase();
  if (rs === 'due') return 'bg-rose-50 text-rose-600 ring-rose-200';
  return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
}

function SearchPeople({ allowedBlocks }) {
  const [houseNo, setHouseNo] = useState('');
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [referenceReceiptNo, setReferenceReceiptNo] = useState('');
  const [selectedBlock, setSelectedBlock] = useState('');
  const [receiptStatus, setReceiptStatus] = useState('');
  const [transactionFilter, setTransactionFilter] = useState('');
  const [allData, setAllData] = useState([]);
  const [filteredData, setFilteredData] = useState(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [availableBlocks, setAvailableBlocks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

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
      const response = await axios.post(`${API_BASE_URL}/api/search-houses`, {
        allowedBlocks: allowedBlocks || [],
      });
      setAllData(response.data || []);
    } catch (error) {
      console.error('Error fetching all data:', error);
    }
  }, [allowedBlocks]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

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

  const handleSearch = () => {
    setLoading(true);
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
      const yearInt = parseInt(year, 10);
      data = data.filter(d => {
        const fromPayment = extractYear(d.yearofpayment);
        const fromSubscription = extractYear(d.yearofsubscription);
        return fromPayment === yearInt || fromSubscription === yearInt;
      });
    }
    if (referenceReceiptNo.trim()) {
      const q = referenceReceiptNo.trim().toLowerCase();
      data = data.filter(d => (d.reference_receipt_no || '').toLowerCase().includes(q));
    }
    if (transactionFilter === 'done') {
      data = data.filter(d => hasTxn(d));
    } else if (transactionFilter === 'not_done') {
      data = data.filter(d => !hasTxn(d));
    }
    if (receiptStatus) {
      data = data.filter(d => {
        if (!hasTxn(d)) return false;
        const rs = (d.receiptstatus || '').toLowerCase();
        return receiptStatus === 'collected'
          ? (rs === 'collected' || rs === 'completed')
          : rs === receiptStatus;
      });
    }

    const results = data.map(item => ({
      houseno: item.houseno,
      name: item.name,
      contact: item.contact,
      block: item.block,
      year: extractYear(item.yearofpayment) || extractYear(item.yearofsubscription) || '',
      totalAmount: parseFloat(item.total_amount || 0),
      amountPaidLastYear: item.amountpaidlastyear || 0,
      receiptStatus: item.receiptstatus || '',
      referenceReceiptNo: item.reference_receipt_no || '',
      has_transaction: hasTxn(item),
    }));

    setFilteredData(results);
    setTotalAmount(
      results
        .filter(r => (r.receiptStatus || '').toLowerCase() !== 'due')
        .reduce((sum, r) => sum + r.totalAmount, 0)
    );
    setShowDropdown(false);
    setLoading(false);

    if (results.length === 0) setShowModal(true);
  };

  const resetFilters = () => {
    setHouseNo('');
    setName('');
    setYear('');
    setReferenceReceiptNo('');
    setSelectedBlock('');
    setReceiptStatus('');
    setTransactionFilter('');
    setFilteredData(null);
    setTotalAmount(0);
    setFilteredSuggestions([]);
    setShowDropdown(false);
  };

  const closeModal = () => setShowModal(false);

  useEffect(() => {
    const handleClickOutside = event => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const paidCount = (filteredData || []).filter(r => r.has_transaction).length;
  const unpaidCount = (filteredData || []).filter(r => !r.has_transaction).length;

  return (
    <div className="relative w-full min-h-full p-4 md:p-8 overflow-hidden">

      <div className="pointer-events-none absolute -top-24 left-10 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl animate-floatBlob" />
      <div className="pointer-events-none absolute bottom-0 -right-24 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl animate-floatBlob" style={{ animationDelay: '4s' }} />

      <div className="relative mb-8 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-blue-500/80">Records</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight neon-text">Search Subscriptions</h1>
        <p className="mt-2 text-sm text-slate-500">
          Results are limited to the blocks assigned to your login.
        </p>
        <div className="mx-auto mt-4 h-[2px] w-40 rounded-full bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
      </div>

      <div className="relative glass-card p-5 md:p-8 space-y-5">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="relative">
            <label className="block text-slate-700 font-semibold mb-2">House No</label>
            <input
              type="text"
              value={houseNo}
              onChange={e => handleHouseNoChange(e.target.value)}
              className="input-neon"
              placeholder="Type to search…"
            />
          </div>

          <div className="relative">
            <label className="block text-slate-700 font-semibold mb-2">Name</label>
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
                <span className="font-semibold text-slate-900">{suggestion.houseno}</span>
                <span className="mx-2 text-slate-300">·</span>
                {suggestion.name}
                {suggestion.block && (
                  <span className="ml-2 text-xs rounded-full bg-blue-50 text-blue-700 px-2 py-0.5">
                    Block {suggestion.block}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-slate-700 font-semibold mb-2">Transaction</label>
            <select
              value={transactionFilter}
              onChange={e => setTransactionFilter(e.target.value)}
              className="input-neon"
            >
              <option value="">All houses</option>
              <option value="done">Transaction done</option>
              <option value="not_done">No transaction yet</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-2">Receipt Status</label>
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

          <div>
            <label className="block text-slate-700 font-semibold mb-2">Block</label>
            <select value={selectedBlock} onChange={e => setSelectedBlock(e.target.value)} className="input-neon">
              <option value="">{isAllAccess ? 'All Blocks' : 'Your blocks'}</option>
              {blockOptions.map((block, index) => (
                <option key={index} value={block}>{block}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-slate-700 font-semibold mb-2">Year of Payment</label>
            <input
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={e => setYear(e.target.value)}
              className="input-neon"
              placeholder="e.g. 2026"
            />
          </div>
          <div>
            <label className="block text-slate-700 font-semibold mb-2">Reference Receipt No</label>
            <input
              type="text"
              value={referenceReceiptNo}
              onChange={e => setReferenceReceiptNo(e.target.value)}
              className="input-neon"
              placeholder="Physical receipt number"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button onClick={handleSearch} className="btn-neon" disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
          <button onClick={resetFilters} className="btn-ghost">Reset</button>
        </div>
      </div>

      {filteredData && filteredData.length > 0 && (
        <div className="relative mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="glass-card px-5 py-4">
              <p className="text-[11px] uppercase tracking-widest text-slate-400">Matches</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{filteredData.length}</p>
            </div>
            <div className="glass-card px-5 py-4">
              <p className="text-[11px] uppercase tracking-widest text-slate-400">Transaction done</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{paidCount}</p>
            </div>
            <div className="glass-card px-5 py-4">
              <p className="text-[11px] uppercase tracking-widest text-slate-400">No transaction</p>
              <p className="mt-1 text-2xl font-bold text-slate-600">{unpaidCount}</p>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  Search results{selectedBlock ? ` · Block ${selectedBlock}` : ''}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {transactionFilter === 'not_done'
                    ? 'Houses in your access that have not made a transaction yet.'
                    : transactionFilter === 'done'
                      ? 'Houses in your access that have completed a transaction.'
                      : 'Houses in your assigned blocks.'}
                </p>
              </div>
              <div className="rounded-full bg-blue-50 px-4 py-1.5 text-sm font-semibold text-blue-700">
                Total collected ₹{totalAmount.toFixed(2)}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3 font-semibold">House</th>
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-5 py-3 font-semibold">Contact</th>
                    <th className="px-5 py-3 font-semibold">Block</th>
                    <th className="px-5 py-3 font-semibold">Year</th>
                    <th className="px-5 py-3 font-semibold">Ref. Receipt</th>
                    <th className="px-5 py-3 font-semibold">Last year</th>
                    <th className="px-5 py-3 font-semibold">This year</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.map((item, index) => (
                    <tr key={index} className="transition hover:bg-blue-50/50">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{item.houseno}</td>
                      <td className="px-5 py-3.5 text-slate-700">{item.name}</td>
                      <td className="px-5 py-3.5 text-slate-600">{item.contact || '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                          {item.block || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{item.year || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-600">{item.referenceReceiptNo || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-600">₹{Number(item.amountPaidLastYear || 0).toFixed(2)}</td>
                      <td className="px-5 py-3.5 font-semibold text-blue-700">₹{item.totalAmount.toFixed(2)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusTone(item)}`}>
                          {statusLabel(item)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm glass-card p-6 text-center animate-fadeIn">
            <p className="text-slate-700 mb-5">No matching records found in your assigned blocks.</p>
            <button onClick={closeModal} className="btn-neon w-full">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchPeople;
