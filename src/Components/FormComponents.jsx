import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './FormComponents.css';
import { API_BASE_URL } from './Constants.jsx';

// ...numberToWords and buildReceiptData remain unchanged...

function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = [
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  if (!num) return '';
  num = Number(num);
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? " " + ones[num % 10] : "");
  if (num < 1000) return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 !== 0 ? " " + numberToWords(num % 100) : "");
  if (num < 10000) return ones[Math.floor(num / 1000)] + " Thousand" + (num % 1000 !== 0 ? " " + numberToWords(num % 1000) : "");
  return num.toString();
}

function buildReceiptData(formData, receiptNo) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB');
  return {
    receiptNo: receiptNo || formData.receiptNo || '',
    date: dateStr,
    name: formData.name,
    address: `${formData.houseNo}${formData.block ? ', Block ' + formData.block : ''}`,
    amountFigure: formData.amountPaid,
    amountWords: numberToWords(Number(formData.amountPaid)),
    paymentMode: formData.paymentMode,
    chequeOrDDNo:
      formData.paymentMode === 'Cheque' || formData.paymentMode === 'DD'
        ? formData.referenceDetails
        : formData.paymentMode === 'NEFT'
          ? formData.utrNumber
          : '',
    drawnOn: '',
    collector: 'Sayan Mitra',
    email: formData.email,
    receiptStatus: formData.receiptStatus
  };
}

function FormComponent({ allowedBlocks }) {
  const [formData, setFormData] = useState({
    houseNo: '',
    name: '',
    contact: '',
    email: '',
    amountPaidLastYear: '',
    previousYearReceiptNumber: '',
    amountPaid: '',
    yearOfPayment: '',
    paymentMode: '',
    utrNumber: '',
    referenceDetails: '',
    block: '',
    amountPaidThisYear: '',
    receiptsThisYear: '',
    receiptStatus: 'collected',
    receiptNo: ''        // <-- Add this field!
  });

  // ...other hooks...
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [allData, setAllData] = useState([]);
  // const [submitEnabled, setSubmitEnabled] = useState(true);
  const [showCreateButton, setShowCreateButton] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showModal, setShowModal] = useState(false);
  // const [searchBy, setSearchBy] = useState('');
  const [showConfirmInactive, setShowConfirmInactive] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({});

  const dropdownRef = useRef(null);

  useEffect(() => {
    // eslint-disable-next-line
    console.log('Received allowedBlocks in FormComponent:', allowedBlocks);
  }, [allowedBlocks]);

  const fetchData = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/data`, {
        allowedBlocks: allowedBlocks
      });
      setAllData(response.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchFinancialYear = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/get-financial-year`);
      setFormData(prev => ({
        ...prev,
        yearOfPayment: response.data.yearOfPayment.toString()
      }));
    } catch (error) {
      console.error('Error fetching financial year:', error);
    }
  };
  const fetchFinancialSummary = async (houseNo) => {
    // 🛡️ GUARD: don't hit the API without a house number
    if (!houseNo) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/financial-summary/${houseNo}`);

      setFormData(prev => ({
        ...prev,
        amountPaidThisYear: res.data.totalAmount,
        receiptsThisYear: res.data.receipts
      }));

    } catch (err) {
      console.error("Error fetching financial summary:", err);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/receipt-config`);
      setConfig(res.data);
    } catch (err) {
      console.error("Failed to fetch config", err);
    }
  };

  // 🚀 INITIAL LOAD ONLY — no fetchFinancialSummary() here (needs a houseNo)
  useEffect(() => {
    fetchFinancialYear();
    fetchData();
    fetchConfig();
    // eslint-disable-next-line
  }, [allowedBlocks]);

  useEffect(() => {
    const handleClickOutside = event => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function sendReceiptToBackend(receiptData) {
    try {
      await axios.post(`${API_BASE_URL}/api/send-receipt`, {
        email: formData.email,
        formData: formData,
        receiptData: receiptData
      });
    } catch (err) {
      console.error('Failed to send receipt:', err);
    }
  }

  // Build the WhatsApp message text (optionally including the receipt link)
  const buildWhatsAppMessage = ({ name, receiptNo, houseNo, amountPaid, yearOfPayment, paymentMode, receiptLink }) => {
    const lines = [
      "🧾 Sarbojanin Durgotsab Receipt",
      "",
      `Hello ${name || ""},`,
      "",
      "Your transaction has been completed successfully.",
      "",
      `📌 Receipt No: ${receiptNo || ""}`,
      `🏠 House No: ${houseNo || ""}`,
      `💰 Amount Paid: ₹${amountPaid || ""}`,
      `📅 Financial Year: ${yearOfPayment || ""}`,
      `💳 Payment Mode: ${paymentMode || ""}`,
    ];

    if (receiptLink) {
      lines.push("", "🔗 View / download your receipt here:", receiptLink);
    }

    lines.push("", "Thank you for your contribution 🙏", "Lake Gardens People's Association");
    return lines.join("\n");
  };

  // Core WhatsApp redirect. Opens WhatsApp with a pre-filled message + receipt link.
  const openWhatsApp = ({ contact, name, receiptNo, houseNo, amountPaid, yearOfPayment, paymentMode, receiptLink }) => {
    const digits = String(contact || "").replace(/\D/g, "");
    if (!digits) return false;

    const phone = `91${digits}`;
    const message = buildWhatsAppMessage({ name, receiptNo, houseNo, amountPaid, yearOfPayment, paymentMode, receiptLink });
    const whatsappURL = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(whatsappURL, "_blank");
    return true;
  };

  // Manual "Send WhatsApp" button — uses whatever is currently in the form + last receipt.
  const sendWhatsAppMessage = () => {
    if (!formData.contact) {
      alert("Customer contact number not available");
      return;
    }

    if (!formData.receiptNo) {
      alert("Please save transaction first");
      return;
    }

    openWhatsApp({
      contact: formData.contact,
      name: formData.name,
      receiptNo: formData.receiptNo,
      houseNo: formData.houseNo,
      amountPaid: formData.amountPaid,
      yearOfPayment: formData.yearOfPayment,
      paymentMode: formData.paymentMode,
      receiptLink: receiptData?.receiptViewUrl || receiptData?.receiptImageUrl,
    });
  };

  // Programmatically trigger a file download in the browser
  const triggerDownload = (href, filename) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Auto-download the receipt (as a PNG) to the collector's device after a save.
  // Prefers the SVG text returned by the backend (no cross-origin fetch needed);
  // falls back to fetching the stored image URL. Converts SVG -> PNG via canvas.
  const autoDownloadReceipt = async ({ svgText, imageUrl, filenameBase }) => {
    const safeBase = String(filenameBase || "Receipt").replace(/[^\w-]+/g, "_");

    let svg = svgText;
    if (!svg && imageUrl) {
      try {
        const resp = await fetch(imageUrl);
        svg = await resp.text();
      } catch (err) {
        console.error("Could not fetch receipt for download:", err);
        return;
      }
    }
    if (!svg) return;

    const svgBlob = new Blob([svg], { type: "image/svg+xml" });
    const blobUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 820;
        canvas.height = img.naturalHeight || 640;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((pngBlob) => {
          if (pngBlob) {
            const pngUrl = URL.createObjectURL(pngBlob);
            triggerDownload(pngUrl, `${safeBase}.png`);
            setTimeout(() => URL.revokeObjectURL(pngUrl), 4000);
          } else {
            triggerDownload(blobUrl, `${safeBase}.svg`);
          }
          URL.revokeObjectURL(blobUrl);
        }, "image/png");
      } catch {
        triggerDownload(blobUrl, `${safeBase}.svg`);
      }
    };
    img.onerror = () => triggerDownload(blobUrl, `${safeBase}.svg`);
    img.src = blobUrl;
  };

  const handleHouseNoChange = value => {
    const lowerValue = value.toLowerCase();

    // 🔥 WHEN EMPTY → FULL RESET
    if (value.trim() === '') {
      setFormData(prev => ({
        houseNo: '',
        name: '',
        contact: '',
        email: '',
        amountPaidLastYear: '',
        previousYearReceiptNumber: '',
        amountPaid: '',
        yearOfPayment: prev.yearOfPayment, // ✅ keep this
        paymentMode: '',
        utrNumber: '',
        referenceDetails: '',
        block: '',
        receiptStatus: 'collected',
        receiptNo: ''
      }));

      setFilteredSuggestions([]);
      setShowDropdown(false);
      // setSubmitEnabled(true);
      setShowCreateButton(false);
      setShowQR(false);

      return;
    }

    // 🔥 NORMAL FLOW
    setFormData(prev => ({ ...prev, houseNo: value }));

    const filtered = allData.filter(item =>
      item.houseno?.toLowerCase().includes(lowerValue)
    );

    setFilteredSuggestions(filtered);
    setShowDropdown(filtered.length > 0);
    // setSubmitEnabled(filtered.length === 0);

    const exactMatch = allData.find(item =>
      item.houseno?.toLowerCase() === lowerValue
    );

    setShowCreateButton(!exactMatch);
  };


  // const handleNameChange = value => {
  //   const lowerValue = value.toLowerCase();

  //   setFormData(prev => ({ ...prev, name: value }));

  //   if (value.trim() === '') {
  //     setFilteredSuggestions([]);
  //     setShowDropdown(false);
  //     setSubmitEnabled(true);
  //     return;
  //   }

  //   const filtered = allData.filter(item =>
  //     item.name?.toLowerCase().includes(lowerValue)
  //   );

  //   setFilteredSuggestions(filtered);
  //   setShowDropdown(filtered.length > 0);
  //   setSubmitEnabled(filtered.length === 0);
  // };

  const handleInputChange = (field, value) => {
    if (field === 'contact') {
      const digitsOnly = value.replace(/\D/g, '');
      if (digitsOnly.length <= 10) {
        setFormData(prev => ({ ...prev, [field]: digitsOnly }));
      }
    } else if (field === 'amountPaid') {
      if (Number(value) >= 0) {
        setFormData(prev => ({ ...prev, [field]: value }));
      }
    } else if (field === 'email') {
      setFormData(prev => ({ ...prev, email: value }));
    } else if (field === 'receiptStatus') {
      setFormData(prev => ({ ...prev, receiptStatus: value }));
    } else if (field === 'previousYearReceiptNumber') {
      setFormData(prev => ({ ...prev, previousYearReceiptNumber: value }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleButtonClick = (field) => {
    const value = formData[field].trim().toLowerCase();


    if (value) {
      const filtered = allData.filter(item => {
        const target = field === 'houseNo' ? item.houseno : item.name;
        return target?.toLowerCase().startsWith(value);
      });

      setFilteredSuggestions(filtered);
      setShowDropdown(filtered.length > 0);
      // setSubmitEnabled(filtered.length === 0);

      if (filtered.length === 0) {
        setShowModal(true);
      }
    } else {
      setFilteredSuggestions([]);
      setShowDropdown(false);
      // setSubmitEnabled(true);
    }
  };

  //   const fetchReceiptFromBackend = async (receiptNo) => {
  //   try {
  //     const res = await axios.get(`${API_BASE_URL}/api/receipts`);

  //     const receipt = res.data.find(r => r.receipt_no === receiptNo);

  //     return receipt || null;
  //   } catch (err) {
  //     console.error("Error fetching receipt:", err);
  //     return null;
  //   }
  // };

  const handleSelectSuggestion = suggestion => {
    setFormData(prev => ({
      houseNo: suggestion.houseno || '',
      name: suggestion.name || '',
      contact: suggestion.contact || '',
      email: suggestion.email || '',
      block: suggestion.block || '',
      amountPaidLastYear: suggestion.amountpaidlastyear || '',
      previousYearReceiptNumber: suggestion.previousyearreceiptnumber || '',

      amountPaid: '',
      yearOfPayment: prev.yearOfPayment,
      paymentMode: '',
      utrNumber: '',
      referenceDetails: '',
      receiptStatus:
        suggestion.receiptstatus
          ? suggestion.receiptstatus.toLowerCase() === 'due' ? 'due' : 'collected'
          : 'collected',
      receiptNo: suggestion.receipt_no || ''
      // <-- Set receiptNo if available
    }));
    setShowDropdown(false);
    // setSubmitEnabled(false);
    setShowCreateButton(false);
    // ❌ REMOVED: fetchFinancialYear() — the year hasn't changed since page load
    fetchFinancialSummary(suggestion.houseno);
  };

  const handleToggleInactive = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/update-customer-state`, {
        houseNo: formData.houseNo,
        newState: 'inactive'
      });
      alert(`Customer with house no ${formData.houseNo} has been set to inactive.`);

      // 🔥 REMOVE ROW LOCALLY instead of refetching everything
      setAllData(prev =>
        prev.filter(row => row.houseno?.toLowerCase() !== formData.houseNo.toLowerCase())
      );

      resetForm();
    } catch (error) {
      alert('Failed to update customer state.');
    }
  };

  const handleSubmitTransaction = async event => {
    event.preventDefault();

    setLoading(true);

    try {
      const payload = { ...formData, amountPaid: parseFloat(formData.amountPaid) };

      const response = await axios.post(`${API_BASE_URL}/api/save-transaction`, payload);

      const receiptNo = response.data.receiptNo || "";
      setFormData(prev => ({ ...prev, receiptNo }));

      // 🔥 OPTIMISTIC LOCAL UPDATE — patch the matching row in allData
      // instead of refetching the entire dataset from the DB.
      setAllData(prevData => prevData.map(row => {
        const sameHouse = row.houseno?.toLowerCase() === formData.houseNo.toLowerCase();
        const sameName = row.name?.toLowerCase() === formData.name.toLowerCase();
        if (sameHouse && sameName) {
          return {
            ...row,
            contact: formData.contact,
            email: formData.email,
            block: formData.block,
            receiptstatus: formData.receiptStatus,
            // Prepend new receipt no so ordering matches the backend's DESC sort
            receipt_no: row.receipt_no
              ? `${receiptNo}, ${row.receipt_no}`
              : receiptNo,
          };
        }
        return row;
      }));

      // ✅ FETCH RECEIPT FROM BACKEND
      const receiptToShow = buildReceiptData(formData, receiptNo);

      // Store image + viewer URLs from Supabase (returned by backend after upload)
      const receiptImageUrl = response.data.receiptImageUrl || "";
      const receiptViewUrl = response.data.receiptViewUrl || "";
      const receiptSvg = response.data.receiptSvg || "";
      setReceiptData({ ...receiptToShow, receiptImageUrl, receiptViewUrl });
      setShowReceiptModal(true);

      // 📲 REDIRECT TO WHATSAPP with the readable receipt link (fires on save)
      openWhatsApp({
        contact: formData.contact,
        name: formData.name,
        receiptNo,
        houseNo: formData.houseNo,
        amountPaid: formData.amountPaid,
        yearOfPayment: formData.yearOfPayment,
        paymentMode: formData.paymentMode,
        receiptLink: receiptViewUrl || receiptImageUrl,
      });

      // ⬇️ AUTO-DOWNLOAD the receipt to this device
      autoDownloadReceipt({ svgText: receiptSvg, imageUrl: receiptImageUrl, filenameBase: `Receipt-${formData.name}-${formData.houseNo}-${receiptNo}` });

      // ✅ SEND EMAIL ONLY IF EXISTS
      if (formData.email) {
        const receiptToSend = buildReceiptData(formData, receiptNo);
        await sendReceiptToBackend(receiptToSend);
      }

      setTimeout(() => {
        // ❌ REMOVED: fetchData() and fetchFinancialYear() — handled locally above
        resetForm();
      }, 1500);

    } catch (error) {
      alert('Failed to save transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleCreateNewRecord = async () => {
    try {
      const payload = {
        ...formData,
        amountPaid: parseFloat(formData.amountPaid),
        amountPaidLastYear: parseFloat(formData.amountPaidLastYear) || 0,
        receiptStatus: formData.receiptStatus || 'collected'
      };

      const response = await axios.post(`${API_BASE_URL}/api/create-new-house`, payload);

      const receiptNo = response.data.receiptNo || "";
      setFormData(prev => ({ ...prev, receiptNo }));

      // 🔥 APPEND NEW ROW LOCALLY instead of refetching everything
      setAllData(prev => [
        ...prev,
        {
          houseno: formData.houseNo,
          name: formData.name,
          contact: formData.contact,
          email: formData.email,
          block: formData.block,
          amountpaidlastyear: parseFloat(formData.amountPaidLastYear) || 0,
          receiptstatus: formData.receiptStatus || 'collected',
          previousyearreceiptnumber: formData.previousYearReceiptNumber || '',
          receipt_no: receiptNo,
        },
      ]);

      // ✅ FETCH FROM BACKEND
      const receiptToShow = buildReceiptData(formData, receiptNo);

      const receiptImageUrl = response.data.receiptImageUrl || "";
      const receiptViewUrl = response.data.receiptViewUrl || "";
      const receiptSvg = response.data.receiptSvg || "";
      setReceiptData({ ...receiptToShow, receiptImageUrl, receiptViewUrl });
      setShowReceiptModal(true);

      // 📲 REDIRECT TO WHATSAPP with the readable receipt link (fires on save)
      openWhatsApp({
        contact: formData.contact,
        name: formData.name,
        receiptNo,
        houseNo: formData.houseNo,
        amountPaid: formData.amountPaid,
        yearOfPayment: formData.yearOfPayment,
        paymentMode: formData.paymentMode,
        receiptLink: receiptViewUrl || receiptImageUrl,
      });

      // ⬇️ AUTO-DOWNLOAD the receipt to this device
      autoDownloadReceipt({ svgText: receiptSvg, imageUrl: receiptImageUrl, filenameBase: `Receipt-${formData.name}-${formData.houseNo}-${receiptNo}` });

      // ✅ EMAIL OPTIONAL
      if (formData.email) {
        const receiptToSend = buildReceiptData(formData, receiptNo);
        await sendReceiptToBackend(receiptToSend);
      }

      // ❌ REMOVED: await fetchData() and await fetchFinancialYear() — done locally above

    } catch (err) {
      alert('Failed to create new entry.');
    }
  };


  const resetForm = () => {
    setFormData(prev => ({
      houseNo: '',
      name: '',
      contact: '',
      email: '',
      amountPaidLastYear: '',
      previousYearReceiptNumber: '',
      amountPaid: '',
      yearOfPayment: prev.yearOfPayment,
      paymentMode: '',
      utrNumber: '',
      referenceDetails: '',
      block: '',
      receiptStatus: 'collected',
      receiptNo: '',
      amountPaidThisYear: '',
      receiptsThisYear: '',  // Reset receiptNo
    }));
    setFilteredSuggestions([]);
    setShowDropdown(false);
    // setSubmitEnabled(true);
    setShowCreateButton(false);
    setShowQR(false);
  };

  return (
    <div className="relative w-full min-h-full p-4 md:p-8 overflow-hidden">

      {/* Ambient animated glow blobs */}
      <div className="pointer-events-none absolute -top-24 right-10 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl animate-floatBlob" />
      <div className="pointer-events-none absolute bottom-0 -left-24 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl animate-floatBlob" style={{ animationDelay: '5s' }} />

      <div className="relative mb-8 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-blue-500/80">Subscription</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight neon-text">Form Submission</h1>
        <div className="mx-auto mt-4 h-[2px] w-40 rounded-full bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
      </div>

      <form
        onSubmit={handleSubmitTransaction}
        className="relative glass-card p-5 md:p-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* House No */}
          <div className="relative">
            <label className="block text-slate-700 font-semibold mb-2">
              House No
            </label>
            <input
              type="text"
              value={formData.houseNo}
              onChange={(e) => handleHouseNoChange(e.target.value)}
              required
              className="input-neon"
            />
          </div>

          {/* Name */}
          <div className="relative">
            <label className="block text-slate-700 font-semibold mb-2">
              Name
            </label>

            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              required
              className="input-neon"
            />

            <button
              type="button"
              onClick={() => handleButtonClick("name")}
              className="btn-neon mt-3 !px-4 !py-2 text-sm"
            >
              Show Options
            </button>
          </div>

          {showDropdown && filteredSuggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="md:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-neon max-h-64 overflow-y-auto z-50"
            >
              {filteredSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="px-4 py-3 cursor-pointer transition hover:bg-blue-50 border-b border-slate-100 last:border-b-0"
                >
                  <div className="font-semibold text-slate-900">
                    {suggestion.houseno}
                  </div>

                  <div className="text-slate-700">
                    {suggestion.name}
                  </div>

                  <div className="text-sm text-slate-500">
                    {suggestion.contact}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Receipt No */}
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              Receipt No
            </label>
            <input
              type="text"
              value={formData.receiptNo || ""}
              readOnly
              className="w-full rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 font-semibold text-blue-700"
            />
          </div>

          {/* Receipts This Year */}
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              Receipts Made This Financial Year
            </label>
            <input
              type="text"
              value={formData.receiptsThisYear}
              readOnly
              className="w-full rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-blue-700"
            />
          </div>

          {/* Contact */}
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              Contact
            </label>
            <input
              type="text"
              value={formData.contact}
              onChange={(e) =>
                handleInputChange("contact", e.target.value)
              }
              required
              className="input-neon"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                handleInputChange("email", e.target.value)
              }
              placeholder="Enter email if you want a copy"
              className="input-neon"
            />
          </div>

          {/* Block */}
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              Block
            </label>

            <select
              value={formData.block}
              onChange={(e) =>
                handleInputChange("block", e.target.value)
              }
              required
              className="input-neon"
            >
              <option value="">Select Block</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
          </div>

          {/* Previous Receipt */}
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              Previous Year Receipt Number
            </label>

            <input
              type="text"
              value={formData.previousYearReceiptNumber}
              readOnly
              className="w-full rounded-xl bg-slate-100 border border-slate-200 px-4 py-3 text-slate-600"
            />
          </div>

          {/* Amount Last Year */}
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              Amount Paid Last Year
            </label>

            <input
              type="text"
              value={formData.amountPaidLastYear}
              readOnly
              className="w-full rounded-xl bg-slate-100 border border-slate-200 px-4 py-3 text-slate-600"
            />
          </div>

          {/* Amount This Year */}
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              Amount Paid This Financial Year
            </label>

            <input
              type="text"
              value={formData.amountPaidThisYear}
              readOnly
              className="w-full rounded-xl bg-slate-100 border border-slate-200 px-4 py-3 text-slate-600"
            />
          </div>

          {/* Amount Paid */}
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              Amount Paid
            </label>

            <input
              type="number"
              value={formData.amountPaid}
              onChange={(e) =>
                handleInputChange("amountPaid", e.target.value)
              }
              required
              className="input-neon"
            />
          </div>

          {/* Year */}
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              Year Of Payment
            </label>

            <input
              type="text"
              value={formData.yearOfPayment}
              readOnly
              className="w-full rounded-xl bg-slate-100 border border-slate-200 px-4 py-3 text-slate-600"
            />
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              Payment Mode
            </label>

            <select
              value={formData.paymentMode}
              onChange={(e) => {
                handleInputChange("paymentMode", e.target.value);
                setShowQR(false);
              }}
              required
              className="input-neon"
            >
              <option value="">Select Payment Mode</option>
              <option value="Cash">Cash</option>
              <option value="QR">QR</option>
              <option value="Cheque">Cheque</option>
              <option value="DD">DD</option>
              <option value="NEFT">NEFT</option>
            </select>
          </div>

          {/* Receipt Status */}
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              Receipt Status
            </label>

            <select
              value={formData.receiptStatus}
              onChange={(e) =>
                handleInputChange("receiptStatus", e.target.value)
              }
              required
              className="input-neon"
            >
              <option value="collected">Collected</option>
              <option value="due">Due</option>
            </select>
          </div>

        </div>

        {/* Action Buttons */}

        <div className="flex flex-wrap gap-4 justify-center md:justify-end mt-8">

          <button
            type="submit"
            disabled={loading}
            className="btn-neon min-w-[180px]"
          >
            {loading ? "Processing..." : "Save Transaction"}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!formData.receiptNo) {
                alert("No receipt generated yet");
                return;
              }

              setReceiptData(
                buildReceiptData(formData, formData.receiptNo)
              );
              setShowReceiptModal(true);
            }}
            className="btn-ghost"
          >
            Preview Receipt
          </button>

          <button
            type="button"
            onClick={sendWhatsAppMessage}
            className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 font-semibold text-white bg-gradient-to-r from-emerald-500 to-green-600 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all duration-300 hover:-translate-y-0.5"
          >
            Send WhatsApp
          </button>

          {showCreateButton && (
            <button
              type="button"
              onClick={handleCreateNewRecord}
              className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 font-semibold text-white bg-gradient-to-r from-emerald-500 to-green-600 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all duration-300 hover:-translate-y-0.5"
            >
              Create New Entry
            </button>
          )}

          {formData.houseNo && (
            <button
              type="button"
              onClick={() => setShowConfirmInactive(true)}
              className="btn-danger"
            >
              Mark As Inactive
            </button>
          )}
        </div>
      </form>

      {/* No entry modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div
            className="
        w-full
        max-w-md
        bg-white
        rounded-3xl
        shadow-2xl
        p-6
        md:p-8
        animate-fadeIn
      "
          >
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="h-8 w-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Heading */}
            <h2 className="text-xl md:text-2xl font-bold text-center text-gray-800 mb-3">
              Entry Not Found
            </h2>

            {/* Message */}
            <p className="text-center text-gray-600 leading-relaxed">
              Either no entry was found in the database for the entered
              house number, or you do not have permission to access
              records from other blocks.
            </p>

            {/* Button */}
            <div className="mt-8">
              <button
                onClick={() => setShowModal(false)}
                className="
            w-full
            py-3
            rounded-xl
            bg-gradient-to-r
            from-blue-600
            to-indigo-600
            text-white
            font-semibold
            hover:shadow-lg
            hover:scale-[1.02]
            transition-all
            duration-300
          "
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Final confirmation modal for marking as inactive */}
      {showConfirmInactive && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-card p-6 md:p-8 text-center animate-fadeIn">
            <p className="text-slate-700 mb-6">
              Are you sure you want to mark <b className="text-blue-600">{formData.houseNo}</b> as inactive?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                className="btn-danger"
                onClick={async () => {
                  setShowConfirmInactive(false);
                  await handleToggleInactive();
                }}
              >
                Yes, Mark as Inactive
              </button>
              <button
                className="btn-ghost"
                onClick={() => setShowConfirmInactive(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-3 py-4">
          <div className="w-[96vw] max-w-[850px] max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-[0_20px_60px_-10px_rgba(37,99,235,0.4)] ring-1 ring-blue-200 animate-fadeIn">

            {receiptData.receiptImageUrl ? (
              <div className="p-4">
                <img
                  src={receiptData.receiptImageUrl}
                  alt={`Receipt ${receiptData.receiptNo}`}
                  className="w-full h-auto rounded-lg border border-slate-200"
                />
              </div>
            ) : (
            <div style={{
              border: '2px dashed #0033cc',
              margin: 20,
              padding: 18,
              fontFamily: "Georgia, Times New Roman, serif",
              background: '#fff',
              color: '#0033cc',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <b>No.</b> <span style={{ fontWeight: 700 }}>{receiptData.receiptNo}</span>
                </div>
                <div>
                  <b>Date:</b> <span style={{ fontWeight: 700, color: '#222' }}>{receiptData.date}</span>
                </div>
              </div>
              <div style={{ fontSize: '1.5em', fontWeight: 700, textAlign: 'center', margin: '8px 0 5px 0', letterSpacing: 1 }}>
                Sarbojanin Durgotsab, 2026
              </div>
              <div style={{ fontStyle: "italic", fontSize: "1.1em", textAlign: "center", color: '#222' }}>
                Organised by : <br />
                <span style={{ fontWeight: 700, color: '#0033cc' }}>SARBOJANIN DURGOTSAB COMMITTEE, LAKE GARDENS</span><br />
                <span style={{ fontWeight: 700 }}>Lake Gardens People’s Association</span><br />
                <span style={{ fontWeight: 400, color: '#0033cc', fontSize: '1em' }}>
                  At Bangur Park, B-202 Lake Gardens, Kolkata - 700 045
                </span>
              </div>
              <hr style={{ border: 'none', borderTop: '1.5px solid #0033cc', margin: '12px 0' }} />
              <div style={{ fontStyle: 'italic', color: '#0033cc', marginBottom: 4 }}>
                Received with thanks from <span style={{ fontWeight: 'bold', color: '#333' }}>{receiptData.name}</span>
              </div>
              <div style={{ fontStyle: 'italic', color: '#0033cc', marginBottom: 4 }}>
                of <span style={{ fontWeight: 'bold', color: '#333' }}>{receiptData.address}</span>
              </div>
              <div style={{ fontStyle: 'italic', color: '#0033cc', marginBottom: 4 }}>
                The sum of Rupees <span style={{ fontWeight: 'bold', color: '#333' }}>{receiptData.amountWords} only</span>
              </div>
              <div style={{ color: '#0033cc', marginBottom: 4 }}>
                by <span style={{ fontWeight: 'bold', color: '#333' }}>{receiptData.paymentMode}</span>
                {receiptData.chequeOrDDNo && (
                  <> | Ref/UTR No: <span style={{ fontWeight: 'bold', color: '#333' }}>{receiptData.chequeOrDDNo}</span></>
                )}
              </div>
              <div style={{ fontStyle: 'italic', color: '#0033cc', marginBottom: 8 }}>
                as subscription/donation for Sri Sri Durga Puja, Laxmi Puja and Kali Puja 2026.
              </div>
              <div style={{
                border: '2px solid #0033cc', borderRadius: 7, width: 120, padding: '5px 0', fontSize: '1.25em',
                fontWeight: 'bold', margin: '10px 0 6px 0', textAlign: 'center'
              }}>
                ₹ {receiptData.amountFigure}
              </div>
              {/* Signatures */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', fontSize: '0.98em', marginTop: 32 }}>

                <div style={{ textAlign: 'center' }}>
                  <b>{config.president || "President"}</b>
                  <br />
                  <span style={{ fontStyle: 'italic' }}>President</span>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <b>{config.secretary1 || ""}</b><br />
                  <b>{config.secretary2 || ""}</b><br />
                  <span style={{ fontStyle: 'italic' }}>Jt. General Secretaries</span>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <b>{config.treasurer || receiptData.collector || "Treasurer"}</b><br />
                  <span style={{ fontStyle: 'italic' }}>Treasurer</span>
                </div>

              </div>
            </div>
            )}
            <div className="flex flex-col gap-2 px-4 py-5 sm:flex-row sm:justify-center">
              <button onClick={() => setShowReceiptModal(false)} className="btn-neon w-full sm:w-auto">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FormComponent;