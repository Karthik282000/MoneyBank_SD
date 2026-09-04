import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './FormComponents.css';
import { API_BASE_URL } from './Constants.jsx';
import { FORM_BLOCK_OPTIONS, isOutsideBlock, blockLabel } from './blockAccess.js';

// ...numberToWords and buildReceiptData remain unchanged...

function loggedInCollectorEmail() {
  try {
    return (sessionStorage.getItem('user') || '').trim();
  } catch {
    return '';
  }
}

function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = [
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  function toWords(n) {
    n = Math.floor(Number(n));
    if (!n || Number.isNaN(n)) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + toWords(n % 100) : "");
    if (n < 100000) return toWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + toWords(n % 1000) : "");
    if (n < 10000000) return toWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 !== 0 ? " " + toWords(n % 100000) : "");
    return toWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 !== 0 ? " " + toWords(n % 10000000) : "");
  }
  return toWords(num).toUpperCase();
}

function buildReceiptData(formData, receiptNo) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB');
  return {
    receiptNo: receiptNo || formData.receiptNo || '',
    date: dateStr,
    name: formData.name,
    address: `${formData.houseNo}${
      formData.block
        ? (isOutsideBlock(formData.block) ? ', Outside society' : ', Block ' + formData.block)
        : ''
    }`,
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
    receiptStatus: formData.receiptStatus,
    bhog: formData.bhog
  };
}

function todayISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function showsBankTxnFields(mode) {
  const m = String(mode || '').toUpperCase();
  return ['QR', 'CHEQUE', 'DD', 'NEFT', 'UTR'].includes(m);
}

function RequiredStar() {
  return <span className="text-rose-500 ml-0.5" aria-hidden="true">*</span>;
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
    bhog: '1',
    referenceReceiptNumber: '',
    transactionReference: '',
    transactionDated: todayISODate(),
    bankName: '',
    receiptNo: ''        // <-- Add this field!
  });

  // When arriving from the Home "Complete" button, we finalize an existing DUE
  // entry instead of creating a brand-new transaction.
  const [completingDue, setCompletingDue] = useState(false);
  const completingDueRef = useRef(false);
  const [showDueConfirm, setShowDueConfirm] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // ...other hooks...
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [allData, setAllData] = useState([]);
  // const [submitEnabled, setSubmitEnabled] = useState(true);
  const [showCreateButton, setShowCreateButton] = useState(false);
  const [,setShowQR] = useState(false);
  const [showModal, setShowModal] = useState(false);
  // const [searchBy, setSearchBy] = useState('');
  const [showConfirmInactive, setShowConfirmInactive] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({});

  const dropdownRef = useRef(null);

  // Block options honoring role-based access: all-access users get every block,
  // restricted users can only ever pick (and therefore create in) their own blocks.
  const isAllAccess = Array.isArray(allowedBlocks) && allowedBlocks.includes('ALLBLOCKS');
  const blockOptions = isAllAccess
    ? FORM_BLOCK_OPTIONS
    : (Array.isArray(allowedBlocks) ? allowedBlocks.filter(b => b !== 'ALLBLOCKS' && b !== 'NO_OUTSIDE') : []);

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

  // Preview the next receipt number that will be assigned on save (does not consume it).
  const fetchNextReceiptNo = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/next-receipt-no`);
      if (res.data?.receiptNo && !completingDueRef.current) {
        setFormData(prev => ({ ...prev, receiptNo: res.data.receiptNo }));
      }
    } catch (err) {
      console.error("Failed to fetch next receipt no", err);
    }
  };

  // 🚀 INITIAL LOAD ONLY — no fetchFinancialSummary() here (needs a houseNo)
  useEffect(() => {
    fetchFinancialYear();
    fetchData();
    fetchConfig();
    // Don't overwrite a due-completion receipt number with the next-seq preview
    if (!location.state?.completeDue) {
      fetchNextReceiptNo();
    }
    // eslint-disable-next-line
  }, [allowedBlocks]);

  // Prefill from the Home "Complete" action (finalizing a due entry)
  useEffect(() => {
    const due = location.state?.completeDue;
    if (!due) return;

    setFormData(prev => ({
      ...prev,
      houseNo: due.houseno || '',
      name: due.name || '',
      contact: due.contact || '',
      email: due.email || '',
      block: due.block || '',
      amountPaidLastYear: due.amountpaidlastyear || '',
      previousYearReceiptNumber: due.previousyearreceiptnumber || '',
      amountPaid: due.amount != null ? String(due.amount) : '',
      bhog: due.bhog != null && due.bhog !== '' ? String(due.bhog) : '1',
      paymentMode: '',
      utrNumber: '',
      referenceDetails: '',
      referenceReceiptNumber: due.reference_receipt_no || '',
      transactionReference: due.transaction_reference || '',
      transactionDated: due.transaction_dated
        ? String(due.transaction_dated).slice(0, 10)
        : todayISODate(),
      bankName: due.bank_name || '',
      receiptStatus: 'collected',
      receiptNo: due.receipt_no || ''
    }));
    setCompletingDue(true);
    completingDueRef.current = true;
    setShowDueConfirm(true);
    setShowCreateButton(false);

    // Clear router state so a refresh doesn't re-trigger completion mode
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line
  }, [location.state]);

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
        bhog: '1',
        referenceReceiptNumber: '',
        transactionReference: '',
        transactionDated: todayISODate(),
        bankName: '',
        receiptNo: prev.receiptNo || '', // keep next-receipt preview
        amountPaidThisYear: '',
        receiptsThisYear: '',
      }));

      setFilteredSuggestions([]);
      setShowDropdown(false);
      setShowCreateButton(false);
      setShowQR(false);
      setCompletingDue(false);
      completingDueRef.current = false;
      fetchNextReceiptNo();

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
    } else if (field === 'bhog') {
      const digitsOnly = value.replace(/\D/g, '');
      setFormData(prev => ({ ...prev, bhog: digitsOnly }));
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
      amountPaidThisYear: '',
      receiptsThisYear: '',

      amountPaid: '',
      yearOfPayment: prev.yearOfPayment,
      paymentMode: '',
      utrNumber: '',
      referenceDetails: '',
      bhog: '1',
      referenceReceiptNumber: '',
      transactionReference: '',
      transactionDated: todayISODate(),
      bankName: '',
      receiptStatus:
        suggestion.receiptstatus
          ? suggestion.receiptstatus.toLowerCase() === 'due' ? 'due' : 'collected'
          : 'collected',
      // Keep the previewed NEXT receipt number — do NOT copy past receipts here
      receiptNo: prev.receiptNo || ''
    }));
    setShowDropdown(false);
    setShowCreateButton(false);
    fetchFinancialSummary(suggestion.houseno);
    // Refresh next-receipt preview in case another collector saved meanwhile
    if (!completingDueRef.current) fetchNextReceiptNo();
  };

  const handleToggleInactive = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/update-customer-state`, {
        houseNo: formData.houseNo,
        state: 'inactive'
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

  // Shared post-save receipt delivery: show + auto-download, and only open
  // WhatsApp when a contact number is present.
  const deliverReceipt = ({ receiptNo, receiptImageUrl, receiptViewUrl, receiptSvg }) => {
    const receiptToShow = buildReceiptData(formData, receiptNo);

    // Prefer the freshly generated SVG so the Mahastmi Bhog line / DUE stamp
    // always appear immediately — even if a cached Supabase image is stale.
    let displayUrl = receiptImageUrl || '';
    if (receiptSvg) {
      displayUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(receiptSvg)}`;
    }

    setReceiptData({
      ...receiptToShow,
      receiptImageUrl: displayUrl,
      receiptViewUrl: receiptViewUrl || receiptImageUrl || '',
      receiptSvg: receiptSvg || '',
    });
    setShowReceiptModal(true);

    // 📲 WhatsApp ONLY if a contact number was provided
    if (String(formData.contact || '').replace(/\D/g, '')) {
      openWhatsApp({
        contact: formData.contact,
        name: formData.name,
        receiptNo,
        houseNo: formData.houseNo,
        amountPaid: formData.amountPaid,
        yearOfPayment: formData.yearOfPayment,
        paymentMode: formData.paymentMode,
        // Share the public Supabase link (not the data: URL)
        receiptLink: receiptImageUrl || receiptViewUrl,
      });
    }

    // ⬇️ ALWAYS auto-download the receipt to this device
    autoDownloadReceipt({
      svgText: receiptSvg,
      imageUrl: receiptImageUrl,
      filenameBase: `Receipt-${formData.name}-${formData.houseNo}-${receiptNo}${(formData.receiptStatus || '').toLowerCase() === 'due' ? '-DUE' : ''}`,
    });
  };

  const handleSubmitTransaction = async event => {
    event.preventDefault();

    if (completingDue && showDueConfirm) {
      return;
    }

    // Payment mode is required unless the entry is being saved as "due"
    if (formData.receiptStatus !== 'due' && !formData.paymentMode) {
      alert('Please select a payment mode.');
      return;
    }

    setLoading(true);

    try {
      // ── COMPLETING A DUE ENTRY ─────────────────────────────────────────────
      if (completingDue) {
        const resp = await axios.post(`${API_BASE_URL}/api/complete-due`, {
          receiptNo: formData.receiptNo,
          paymentMode: formData.paymentMode,
          utrNumber: formData.utrNumber,
          referenceDetails: formData.referenceDetails,
          bhog: formData.bhog,
          contact: formData.contact,
          email: formData.email,
          referenceReceiptNumber: formData.referenceReceiptNumber,
          transactionReference: formData.transactionReference,
          transactionDated: formData.transactionDated,
          bankName: formData.bankName,
          collectorEmail: loggedInCollectorEmail(),
        });

        const receiptNo = resp.data.receiptNo || formData.receiptNo;
        deliverReceipt({
          receiptNo,
          receiptImageUrl: resp.data.receiptImageUrl || '',
          receiptViewUrl: resp.data.receiptViewUrl || '',
          receiptSvg: resp.data.receiptSvg || '',
        });

        if (formData.email) {
          await sendReceiptToBackend(buildReceiptData(formData, receiptNo));
        }

        setCompletingDue(false);
        completingDueRef.current = false;
        setTimeout(() => {
          resetForm();
          navigate('/home');
        }, 1500);
        return;
      }

      // ── NORMAL NEW TRANSACTION ─────────────────────────────────────────────
      const payload = {
        ...formData,
        amountPaid: parseFloat(formData.amountPaid),
        collectorEmail: loggedInCollectorEmail(),
      };

      const response = await axios.post(`${API_BASE_URL}/api/save-transaction`, payload);

      const receiptNo = response.data.receiptNo || "";
      setFormData(prev => ({
        ...prev,
        receiptNo,
        receiptsThisYear: prev.receiptsThisYear
          ? `${receiptNo}, ${prev.receiptsThisYear}`
          : receiptNo,
      }));

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

      // ✅ SHOW + DOWNLOAD receipt; WhatsApp only if a contact number exists
      deliverReceipt({
        receiptNo,
        receiptImageUrl: response.data.receiptImageUrl || "",
        receiptViewUrl: response.data.receiptViewUrl || "",
        receiptSvg: response.data.receiptSvg || "",
      });

      // ✅ SEND EMAIL ONLY IF EXISTS
      if (formData.email) {
        const receiptToSend = buildReceiptData(formData, receiptNo);
        await sendReceiptToBackend(receiptToSend);
      }

      setTimeout(() => {
        // ❌ REMOVED: fetchData() and fetchFinancialYear() — handled locally above
        resetForm();
        fetchNextReceiptNo();
      }, 1500);

    } catch (error) {
      alert(error.response?.data?.error || error.response?.data?.message || 'Failed to save transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleCreateNewRecord = async () => {
    if (formData.receiptStatus !== 'due' && !formData.paymentMode) {
      alert('Please select a payment mode.');
      return;
    }
    try {
      const payload = {
        ...formData,
        amountPaid: parseFloat(formData.amountPaid),
        amountPaidLastYear: parseFloat(formData.amountPaidLastYear) || 0,
        receiptStatus: formData.receiptStatus || 'collected',
        collectorEmail: loggedInCollectorEmail(),
      };

      const response = await axios.post(`${API_BASE_URL}/api/create-new-house`, payload);

      const receiptNo = response.data.receiptNo || "";
      setFormData(prev => ({
        ...prev,
        receiptNo,
        receiptsThisYear: prev.receiptsThisYear
          ? `${receiptNo}, ${prev.receiptsThisYear}`
          : receiptNo,
      }));

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

      // ✅ SHOW + DOWNLOAD receipt; WhatsApp only if a contact number exists
      deliverReceipt({
        receiptNo,
        receiptImageUrl: response.data.receiptImageUrl || "",
        receiptViewUrl: response.data.receiptViewUrl || "",
        receiptSvg: response.data.receiptSvg || "",
      });

      // ✅ EMAIL OPTIONAL
      if (formData.email) {
        const receiptToSend = buildReceiptData(formData, receiptNo);
        await sendReceiptToBackend(receiptToSend);
      }

      // ❌ REMOVED: await fetchData() and await fetchFinancialYear() — done locally above

    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to create new entry.');
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
      bhog: '1',
      referenceReceiptNumber: '',
      transactionReference: '',
      transactionDated: todayISODate(),
      bankName: '',
      receiptNo: '',
      amountPaidThisYear: '',
      receiptsThisYear: '',
    }));
    setFilteredSuggestions([]);
    setShowDropdown(false);
    setShowCreateButton(false);
    setShowQR(false);
    setCompletingDue(false);
    completingDueRef.current = false;
  };

  return (
    <div className="relative w-full min-h-full p-4 md:p-8 overflow-hidden">

      {/* Ambient animated glow blobs */}
      <div className="pointer-events-none absolute -top-24 right-10 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl animate-floatBlob" />
      <div className="pointer-events-none absolute bottom-0 -left-24 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl animate-floatBlob" style={{ animationDelay: '5s' }} />

      <div className="relative mb-8 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-blue-500/80">Subscription</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight neon-text">Form Submission</h1>
        <p className="mt-2 text-xs text-slate-500">
          Fields marked <span className="text-rose-500 font-semibold">*</span> are required
        </p>
        <div className="mx-auto mt-4 h-[2px] w-40 rounded-full bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
      </div>

      <form
        onSubmit={handleSubmitTransaction}
        className="relative glass-card p-5 md:p-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 items-start">

          <div className="field">
            <label className="field-label">House No<RequiredStar /></label>
            <input
              type="text"
              value={formData.houseNo}
              onChange={(e) => handleHouseNoChange(e.target.value)}
              required
              className="input-neon"
            />
          </div>

          <div className="field">
            <label className="field-label">Name<RequiredStar /></label>
            <div className="flex gap-2 items-stretch">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
                className="input-neon flex-1 min-w-0"
              />
              <button
                type="button"
                onClick={() => handleButtonClick("name")}
                className="btn-ghost h-12 shrink-0 px-4 text-sm"
              >
                Options
              </button>
            </div>
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
                  <div className="font-semibold text-slate-900">{suggestion.houseno}</div>
                  <div className="text-slate-700">{suggestion.name}</div>
                  <div className="text-sm text-slate-500">{suggestion.contact}</div>
                </div>
              ))}
            </div>
          )}

          <div className="field">
            <label className="field-label">
              Receipt No
              {completingDue ? null : <span className="text-slate-400 font-normal text-xs">(next)</span>}
            </label>
            <input
              type="text"
              value={formData.receiptNo || ""}
              readOnly
              placeholder="Assigned on save"
              className="w-full h-12 rounded-xl bg-blue-50 border border-blue-200 px-4 font-semibold text-blue-700"
            />
          </div>

          <div className="field">
            <label className="field-label">Receipts This Financial Year</label>
            <input
              type="text"
              value={formData.receiptsThisYear || ""}
              readOnly
              placeholder="None yet"
              className="w-full h-12 rounded-xl bg-blue-50 border border-blue-200 px-4 text-blue-700"
            />
          </div>

          <div className="field">
            <label className="field-label">
              Contact <span className="text-slate-400 font-normal text-xs">(optional)</span>
            </label>
            <input
              type="text"
              value={formData.contact}
              onChange={(e) => handleInputChange("contact", e.target.value)}
              placeholder="Leave blank to skip WhatsApp"
              className="input-neon"
            />
          </div>

          <div className="field">
            <label className="field-label">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              placeholder="Enter email if you want a copy"
              className="input-neon"
            />
          </div>

          <div className="field">
            <label className="field-label">Block<RequiredStar /></label>
            <select
              value={formData.block}
              onChange={(e) => handleInputChange("block", e.target.value)}
              required
              className="input-neon"
            >
              <option value="">Select Block</option>
              {blockOptions.map(b => (
                <option key={b} value={b}>{blockLabel(b)}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field-label">Previous Year Receipt Number</label>
            <input
              type="text"
              value={formData.previousYearReceiptNumber}
              readOnly
              className="w-full h-12 rounded-xl bg-slate-100 border border-slate-200 px-4 text-slate-600"
            />
          </div>

          <div className="field">
            <label className="field-label">Amount Paid Last Year</label>
            <input
              type="text"
              value={formData.amountPaidLastYear}
              readOnly
              className="w-full h-12 rounded-xl bg-slate-100 border border-slate-200 px-4 text-slate-600"
            />
          </div>

          <div className="field">
            <label className="field-label">Amount Paid This Financial Year</label>
            <input
              type="text"
              value={formData.amountPaidThisYear}
              readOnly
              className="w-full h-12 rounded-xl bg-slate-100 border border-slate-200 px-4 text-slate-600"
            />
          </div>

          <div className="field">
            <label className="field-label">Amount Paid<RequiredStar /></label>
            <input
              type="number"
              value={formData.amountPaid}
              onChange={(e) => handleInputChange("amountPaid", e.target.value)}
              required
              className="input-neon"
            />
          </div>

          <div className="field">
            <label className="field-label">Year Of Payment<RequiredStar /></label>
            <input
              type="text"
              value={formData.yearOfPayment}
              readOnly
              className="w-full h-12 rounded-xl bg-slate-100 border border-slate-200 px-4 text-slate-600"
            />
          </div>

          <div className="field">
            <label className="field-label">
              Payment Mode
              {formData.receiptStatus !== 'due' ? <RequiredStar /> : (
                <span className="text-slate-400 font-normal text-xs">(optional for due)</span>
              )}
            </label>
            <select
              value={formData.paymentMode}
              onChange={(e) => {
                handleInputChange("paymentMode", e.target.value);
                setShowQR(false);
              }}
              {...(formData.receiptStatus !== 'due' ? { required: true } : {})}
              className="input-neon"
            >
              <option value="">Select Payment Mode</option>
              <option value="Cash">Cash</option>
              <option value="QR">QR</option>
              <option value="Cheque">Cheque</option>
              <option value="DD">DD</option>
              <option value="NEFT">NEFT</option>
              <option value="UTR">UTR</option>
            </select>
          </div>

          <div className="field">
            <label className="field-label">Receipt Status<RequiredStar /></label>
            <select
              value={formData.receiptStatus}
              onChange={(e) => handleInputChange("receiptStatus", e.target.value)}
              required
              disabled={completingDue}
              className="input-neon disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <option value="collected">Collected</option>
              {!completingDue && <option value="due">Due</option>}
            </select>
          </div>

          {showsBankTxnFields(formData.paymentMode) && (
            <div className="md:col-span-2 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 md:p-5">
              <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold mb-4">
                Bank / instrument details
                <span className="ml-2 normal-case tracking-normal font-normal text-slate-400">(optional)</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-4 items-start">
                <div className="field">
                  <label className="field-label">Transaction Reference#</label>
                  <input
                    type="text"
                    value={formData.transactionReference}
                    onChange={(e) => handleInputChange('transactionReference', e.target.value)}
                    placeholder="UTR# / NEFT# / Cheque#"
                    className="input-neon"
                  />
                </div>
                <div className="field">
                  <label className="field-label">Dated</label>
                  <input
                    type="date"
                    value={formData.transactionDated || todayISODate()}
                    onChange={(e) => handleInputChange('transactionDated', e.target.value)}
                    className="input-neon"
                  />
                </div>
                <div className="field">
                  <label className="field-label">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => handleInputChange('bankName', e.target.value)}
                    placeholder="Bank name"
                    className="input-neon"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="field">
            <label className="field-label">Bhog Packets</label>
            <input
              type="number"
              min="0"
              value={formData.bhog}
              onChange={(e) => handleInputChange("bhog", e.target.value)}
              placeholder="1"
              className="input-neon"
            />
          </div>

          <div className="field">
            <label className="field-label">Reference Receipt No</label>
            <input
              type="text"
              value={formData.referenceReceiptNumber}
              onChange={(e) => handleInputChange("referenceReceiptNumber", e.target.value)}
              placeholder="Physical receipt number"
              className="input-neon"
            />
          </div>

        </div>

        {completingDue && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700">
            Completing due entry for <b>{formData.houseNo}</b> — select a payment mode and save to finalize. Receipt No: <b>{formData.receiptNo}</b>
          </div>
        )}

        {/* Action Buttons */}

        <div className="flex flex-wrap gap-4 justify-center md:justify-end mt-8">

          <button
            type="submit"
            disabled={loading || (completingDue && showDueConfirm)}
            className="btn-neon min-w-[180px]"
          >
            {loading ? "Processing..." : completingDue ? "Complete Transaction" : "Save Transaction"}
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

      {showDueConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-card p-6 md:p-8 text-center animate-fadeIn">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Complete due transaction?</h3>
            <p className="text-slate-600 mb-6 leading-relaxed">
              Once you complete this due transaction you will not be able to change it.
              House <b className="text-blue-600">{formData.houseNo}</b>
              {formData.receiptNo ? <> · Receipt <b>{formData.receiptNo}</b></> : null}.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                className="btn-neon"
                onClick={() => setShowDueConfirm(false)}
              >
                Yes
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setShowDueConfirm(false);
                  setCompletingDue(false);
                  completingDueRef.current = false;
                  resetForm();
                  navigate('/home');
                }}
              >
                No
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
              {(receiptData.receiptStatus || '').toLowerCase() === 'due' && (
                <div style={{
                  margin: '8px auto 0', width: 140, textAlign: 'center',
                  border: '2.5px solid #ff0000', color: '#ff0000', fontWeight: 700,
                  letterSpacing: 4, padding: '4px 0', background: '#ffecec', borderRadius: 6
                }}>
                  DUE
                </div>
              )}
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

              {/* Bhog packets note + count — always shown */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginTop: 10 }}>
                <div style={{ fontWeight: 700, color: '#0033cc' }}>
                  Please collect your "Mahastmi Bhog" from pandal Between 1 pm to 3 pm
                </div>
                <div style={{ border: '2px solid #0033cc', width: 92, height: 92, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '0.7em', fontWeight: 700, color: '#0033cc' }}>BHOG PACKETS</div>
                  <div style={{ fontSize: '1.7em', fontWeight: 700, color: '#222' }}>{receiptData.bhog || 0}</div>
                </div>
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