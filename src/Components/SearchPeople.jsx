import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import './SearchPeople.css';
import { API_BASE_URL } from './Constants.jsx';
import { OUTSIDE_BLOCK, blockLabel, blockPhrase, isOutsideBlock, outsideRowClass } from './blockAccess.js';
import PageLoader from './PageLoader.jsx';
import ExportButtons from './ExportButtons.jsx';

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

const KNOWN_PAYMENT_MODES = ['Cash', 'QR', 'Cheque', 'DD', 'NEFT', 'UTR'];

function splitModes(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchesPaymentMode(row, selected) {
  if (!selected) return true;
  const want = selected.toLowerCase();
  return splitModes(row.modeofpayment).some((m) => m.toLowerCase() === want);
}

function toDateKey(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return localYmd(value);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return localYmd(d);
}

function localYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateKey(key) {
  if (!key) return '—';
  const [y, m, d] = String(key).split('-');
  if (!y || !m || !d) return key;
  return `${d}/${m}/${y}`;
}

function matchesDateFilter(row, { exactDates, rangeFrom, rangeTo }) {
  const hasExact = exactDates.length > 0;
  const hasRange = Boolean(rangeFrom || rangeTo);
  if (!hasExact && !hasRange) return true;
  const key = toDateKey(row.txn_date || row.transaction_dated || row.createdat);
  if (!key) return false;
  if (hasExact && exactDates.includes(key)) return true;
  if (hasRange) {
    const from = rangeFrom || '0000-01-01';
    const to = rangeTo || '9999-12-31';
    if (key >= from && key <= to) return true;
  }
  return false;
}

function outsideMark(block) {
  if (!isOutsideBlock(block)) return null;
  return (
    <span className="mr-2 inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
      Outside
    </span>
  );
}

function SearchPeople({ allowedBlocks }) {
  const [houseNo, setHouseNo] = useState('');
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [referenceReceiptNo, setReferenceReceiptNo] = useState('');
  const [selectedBlock, setSelectedBlock] = useState('');
  const [receiptStatus, setReceiptStatus] = useState('');
  const [transactionFilter, setTransactionFilter] = useState('');
  const [paymentModeFilter, setPaymentModeFilter] = useState('');
  const [dateToAdd, setDateToAdd] = useState('');
  const [exactDates, setExactDates] = useState([]);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [allData, setAllData] = useState([]);
  const [filteredData, setFilteredData] = useState(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [availableBlocks, setAvailableBlocks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
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
        new Set([
          ...allData.map(d => d.block).filter(Boolean),
          OUTSIDE_BLOCK,
        ])
      );
      return distinct.filter(b => b !== 'ALLBLOCKS' && b !== 'NO_OUTSIDE').sort();
    }
    return (availableBlocks || []).filter(b => b !== 'ALLBLOCKS' && b !== 'NO_OUTSIDE');
  }, [isAllAccess, allData, availableBlocks]);

  const paymentModeOptions = useMemo(() => {
    const fromData = new Set();
    allData.forEach((d) => {
      splitModes(d.modeofpayment).forEach((m) => fromData.add(m));
    });
    const extras = [...fromData].filter(
      (m) => !KNOWN_PAYMENT_MODES.some((k) => k.toLowerCase() === m.toLowerCase())
    );
    extras.sort((a, b) => a.localeCompare(b));
    return [...KNOWN_PAYMENT_MODES, ...extras];
  }, [allData]);

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
    let cancelled = false;
    setPageLoading(true);
    fetchAllData().finally(() => {
      if (!cancelled) setPageLoading(false);
    });
    return () => { cancelled = true; };
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
    if (paymentModeFilter) {
      data = data.filter(d => matchesPaymentMode(d, paymentModeFilter));
    }
    if (exactDates.length > 0 || rangeFrom || rangeTo || dateToAdd) {
      const dates = [...exactDates];
      const pending = toDateKey(dateToAdd);
      if (pending && !dates.includes(pending)) dates.push(pending);
      let from = rangeFrom;
      let to = rangeTo;
      if (from && to && from > to) {
        const swap = from;
        from = to;
        to = swap;
      }
      data = data.filter(d => matchesDateFilter(d, { exactDates: dates, rangeFrom: from, rangeTo: to }));
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
      paymentMode: item.modeofpayment || '',
      transactionReference: item.transaction_reference || '',
      bankName: item.bank_name || '',
      transactionDated: item.transaction_dated || '',
      createdat: item.createdat || '',
      txn_date: item.txn_date || '',
      has_transaction: hasTxn(item),
    }));

    setFilteredData(results);
    const entriesTotal = results.reduce((sum, r) => sum + r.totalAmount, 0);
    const collectedTotal = results
      .filter(r => (r.receiptStatus || '').toLowerCase() !== 'due')
      .reduce((sum, r) => sum + r.totalAmount, 0);
    setTotalAmount(paymentModeFilter ? entriesTotal : collectedTotal);
    setShowDropdown(false);
    setLoading(false);

    if (results.length === 0) setShowModal(true);
  };

  const addExactDate = () => {
    const key = toDateKey(dateToAdd);
    if (!key) return;
    setExactDates((prev) => (prev.includes(key) ? prev : [...prev, key].sort()));
    setDateToAdd('');
  };

  const removeExactDate = (key) => {
    setExactDates((prev) => prev.filter((d) => d !== key));
  };

  const resetFilters = () => {
    setHouseNo('');
    setName('');
    setYear('');
    setReferenceReceiptNo('');
    setSelectedBlock('');
    setReceiptStatus('');
    setTransactionFilter('');
    setPaymentModeFilter('');
    setDateToAdd('');
    setExactDates([]);
    setRangeFrom('');
    setRangeTo('');
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

  const searchExportColumns = [
    { header: 'House', value: (r) => r.houseno || '' },
    { header: 'Name', value: (r) => r.name || '' },
    { header: 'Contact', value: (r) => r.contact || '' },
    { header: 'Block', value: (r) => blockLabel(r.block) || r.block || '' },
    { header: 'Year', value: (r) => r.year || '' },
    { header: 'Amount Paid Last Year', value: (r) => Number(Number(r.amountPaidLastYear || 0).toFixed(2)) },
    { header: 'Amount Paid This Year', value: (r) => Number(Number(r.totalAmount || 0).toFixed(2)) },
    { header: 'Payment Mode', value: (r) => r.paymentMode || '' },
    { header: 'Transaction Reference', value: (r) => r.transactionReference || '' },
    { header: 'Bank Name', value: (r) => r.bankName || '' },
    {
      header: 'Transaction Date',
      value: (r) => {
        const raw = r.transactionDated || r.createdat;
        if (!raw) return '';
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB');
      },
    },
    { header: 'Status', value: (r) => statusLabel(r) },
    { header: 'Reference Receipt', value: (r) => r.referenceReceiptNo || '' },
  ];

  return (
    <div className="relative w-full min-h-full p-4 md:p-8 overflow-hidden">
      <PageLoader visible={pageLoading} />

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
                    {blockPhrase(suggestion.block)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
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
                <option key={index} value={block}>{blockLabel(block)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-2">Mode of Payment</label>
            <select
              value={paymentModeFilter}
              onChange={e => setPaymentModeFilter(e.target.value)}
              className="input-neon"
            >
              <option value="">All modes</option>
              {paymentModeOptions.map((mode) => (
                <option key={mode} value={mode}>{mode}</option>
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

        <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 md:p-5 space-y-4">
          <div>
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-blue-500 font-semibold">Transaction date</p>
            <p className="text-xs text-slate-500 mt-1">
              Filter by one date, several dates, a range, or any mix. Use the calendar (6 September is 06/09/2026). Dates follow the transaction date, or the save time in India if that field is empty.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-slate-700 font-semibold mb-2">Add date</label>
              <input
                type="date"
                value={dateToAdd}
                onChange={e => setDateToAdd(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addExactDate();
                  }
                }}
                className="input-neon"
              />
            </div>
            <div>
              <button type="button" onClick={addExactDate} className="btn-ghost h-12 w-full">
                Add date
              </button>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-2">Range from</label>
              <input
                type="date"
                value={rangeFrom}
                onChange={e => setRangeFrom(e.target.value)}
                className="input-neon"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-2">Range to</label>
              <input
                type="date"
                value={rangeTo}
                onChange={e => setRangeTo(e.target.value)}
                className="input-neon"
              />
            </div>
          </div>

          {(exactDates.length > 0 || rangeFrom || rangeTo) && (
            <div className="flex flex-wrap gap-2">
              {exactDates.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => removeExactDate(key)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50"
                  title="Remove date"
                >
                  {formatDateKey(key)}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
              {rangeFrom || rangeTo ? (
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
                  Range {formatDateKey(rangeFrom) || '…'} – {formatDateKey(rangeTo) || '…'}
                </span>
              ) : null}
            </div>
          )}
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
              <p className="text-[11px] uppercase tracking-widest text-slate-400">
                {paymentModeFilter ? `${paymentModeFilter} entries` : 'Transaction done'}
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{paidCount}</p>
            </div>
            <div className="glass-card px-5 py-4">
              <p className="text-[11px] uppercase tracking-widest text-slate-400">
                {paymentModeFilter ? `Total ${paymentModeFilter}` : 'No transaction'}
              </p>
              <p className={`mt-1 text-2xl font-bold ${paymentModeFilter ? 'text-blue-700' : 'text-slate-600'}`}>
                {paymentModeFilter ? `₹${totalAmount.toFixed(2)}` : unpaidCount}
              </p>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  Search results{selectedBlock ? ` · ${blockPhrase(selectedBlock)}` : ''}{paymentModeFilter ? ` · ${paymentModeFilter}` : ''}{(exactDates.length > 0 || rangeFrom || rangeTo || dateToAdd) ? ' · Date filter' : ''}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {transactionFilter === 'not_done'
                    ? 'Houses in your access that have not made a transaction yet.'
                    : transactionFilter === 'done'
                      ? 'Houses in your access that have completed a transaction.'
                      : 'Houses in your assigned blocks.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ExportButtons
                  records={filteredData}
                  columns={searchExportColumns}
                  filename="search-results"
                  sheetName="Search results"
                />
                <div className="rounded-full bg-blue-50 px-4 py-1.5 text-sm font-semibold text-blue-700">
                  {paymentModeFilter
                    ? `Total ${paymentModeFilter} ₹${totalAmount.toFixed(2)}`
                    : `Total collected ₹${totalAmount.toFixed(2)}`}
                </div>
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
                    {/* <th className="px-5 py-3 font-semibold">Ref. Receipt</th> */}
                    <th className="px-5 py-3 font-semibold">Amount Paid Last year</th>
                    <th className="px-5 py-3 font-semibold">Amount Paid This year</th>
                    <th className="px-5 py-3 font-semibold">Payment Mode</th>
                    <th className="px-5 py-3 font-semibold">Txn details</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.map((item, index) => (
                    <tr key={index} className={`transition hover:bg-blue-50/50 ${outsideRowClass(item.block)}`}>
                      <td className="px-5 py-3.5 font-semibold text-slate-900">
                        <span className="inline-flex items-center">
                          {outsideMark(item.block)}
                          {item.houseno}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">{item.name}</td>
                      <td className="px-5 py-3.5 text-slate-600">{item.contact || '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                          {blockLabel(item.block) || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{item.year || '—'}</td>
                      {/* <td className="px-5 py-3.5 text-slate-600">{item.referenceReceiptNo || '—'}</td> */}
                      <td className="px-5 py-3.5 text-slate-600">₹{Number(item.amountPaidLastYear || 0).toFixed(2)}</td>
                      <td className="px-5 py-3.5 font-semibold text-blue-700">₹{item.totalAmount.toFixed(2)}</td>
                      <td className="px-5 py-3.5">
                        {splitModes(item.paymentMode).length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {splitModes(item.paymentMode).map((mode) => (
                              <span
                                key={mode}
                                className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-100"
                              >
                                {mode}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {item.transactionReference || item.bankName || item.transactionDated || item.createdat ? (
                          <div className="space-y-0.5 text-xs">
                            {item.transactionReference ? (
                              <p className="break-all">Ref. {item.transactionReference}</p>
                            ) : null}
                            {item.bankName ? (
                              <p className="break-words">{item.bankName}</p>
                            ) : null}
                            {item.transactionDated || item.createdat ? (
                              <p>{new Date(item.transactionDated || item.createdat).toLocaleDateString()}</p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
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
