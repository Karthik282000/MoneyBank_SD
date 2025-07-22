import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './FormComponents.css';
import { API_BASE_URL } from './Constants.jsx';

function numberToWords(num) {
  // Simple converter, you can use 'number-to-words' npm for more robust conversion
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'
  ];
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];
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
    receiptNo: receiptNo || '', // will be set by backend
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
    drawnOn: '', // Optional
    collector: 'Sayan Mitra',
    email: formData.email
  };
}

function FormComponent({ allowedBlocks }) {
  const [formData, setFormData] = useState({
    houseNo: '',
    name: '',
    contact: '',
    email: '',
    amountPaidLastYear: '',
    amountPaid: '',
    yearOfPayment: '',
    paymentMode: '',
    utrNumber: '',
    referenceDetails: '',
    block: ''
  });

  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [allData, setAllData] = useState([]);
  const [submitEnabled, setSubmitEnabled] = useState(true);
  const [showCreateButton, setShowCreateButton] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchBy, setSearchBy] = useState('');
  const [showConfirmInactive, setShowConfirmInactive] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

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

  useEffect(() => {
    fetchFinancialYear();
    fetchData();
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

  const handleHouseNoChange = value => {
    const match = allData.find(item => item.houseno?.toLowerCase() === value.toLowerCase());
    setShowCreateButton(!match);
    if (value.trim() === '') {
      const currentYear = formData.yearOfPayment;
      resetForm();
      setFormData(prev => ({ ...prev, yearOfPayment: currentYear }));
    } else {
      setFormData({ ...formData, houseNo: value });
      setSubmitEnabled(true);
    }
  };

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
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleButtonClick = (field) => {
    const value = formData[field].trim().toLowerCase();
    setSearchBy(field);

    if (value) {
      const filtered = allData.filter(item => {
        const target = field === 'houseNo' ? item.houseno : item.name;
        return target?.toLowerCase().startsWith(value);
      });

      setFilteredSuggestions(filtered);
      setShowDropdown(filtered.length > 0);
      setSubmitEnabled(filtered.length === 0);

      if (filtered.length === 0) {
        setShowModal(true);
      }
    } else {
      setFilteredSuggestions([]);
      setShowDropdown(false);
      setSubmitEnabled(true);
    }
  };

  const handleSelectSuggestion = suggestion => {
    setFormData(prev => ({
      houseNo: suggestion.houseno || '',
      name: suggestion.name || '',
      contact: suggestion.contact || '',
      email: suggestion.email || '',
      block: suggestion.block || '',
      amountPaidLastYear: suggestion.amountpaidlastyear || '',
      amountPaid: '',
      yearOfPayment: prev.yearOfPayment,
      paymentMode: '',
      utrNumber: '',
      referenceDetails: ''
    }));
    setShowDropdown(false);
    setSubmitEnabled(false);
    setShowCreateButton(false);
    fetchFinancialYear();
  };

  const handleToggleInactive = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/update-customer-state`, {
        houseNo: formData.houseNo,
        newState: 'inactive'
      });
      alert(`Customer with house no ${formData.houseNo} has been set to inactive.`);
      fetchData();
      resetForm();
    } catch (error) {
      alert('Failed to update customer state.');
    }
  };

  const handleSubmitTransaction = async event => {
    event.preventDefault();
    try {
      const payload = { ...formData, amountPaid: parseFloat(formData.amountPaid) };
      const response = await axios.post(`${API_BASE_URL}/api/save-transaction`, payload);

      // You can get receiptNo from backend if your backend returns it
      const receiptNo = response.data.receiptNo || ""; 
      const receiptToSend = buildReceiptData(formData, receiptNo);

       await sendReceiptToBackend(receiptToSend);

      // Send receipt structure to backend to generate image/pdf and send mail
    

      alert('Transaction and receipt sent successfully!');
      await fetchData();
      await fetchFinancialYear();
      resetForm();
    } catch (error) {
      alert('Failed to save transaction. Please try again.');
    }
  };

  const handleCreateNewRecord = async () => {
    try {
      const payload = {
        ...formData,
        amountPaid: parseFloat(formData.amountPaid),
        amountPaidLastYear: parseFloat(formData.amountPaidLastYear) || 0
      };
      await axios.post(`${API_BASE_URL}/api/create-new-house`, payload);
       const receiptToSend = buildReceiptData(formData, ""); // Or a receipt no if available
    await sendReceiptToBackend(receiptToSend);

    
      alert('New house entry and transaction created successfully!');
      await fetchData();
      await fetchFinancialYear();
      resetForm();
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
      amountPaid: '',
      yearOfPayment: prev.yearOfPayment,
      paymentMode: '',
      utrNumber: '',
      referenceDetails: '',
      block: ''
    }));
    setFilteredSuggestions([]);
    setShowDropdown(false);
    setSubmitEnabled(true);
    setShowCreateButton(false);
    setShowQR(false);
  };

  return (
    <div className="App">
      <h1>Form Submission</h1>
      <form onSubmit={handleSubmitTransaction}>
        <div style={{ position: 'relative' }}>
          <label>House No:</label>
          <input
            type="text"
            value={formData.houseNo}
            onChange={e => handleHouseNoChange(e.target.value)}
            required
          />
          <button type="button" onClick={() => handleButtonClick('houseNo')}>Show Options</button>
        </div>

        <div style={{ position: 'relative' }}>
          <label>Name:</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => handleInputChange('name', e.target.value)}
            required
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

        <div>
          <label>Contact:</label>
          <input
            type="text"
            value={formData.contact}
            onChange={e => handleInputChange('contact', e.target.value)}
            required
          />
        </div>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={formData.email}
            onChange={e => handleInputChange('email', e.target.value)}
            placeholder="Enter email if you want a copy"
          />
        </div>
        <div>
          <label>Block:</label>
          <select value={formData.block} onChange={e => handleInputChange('block', e.target.value)} required>
            <option value="">Select Block</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
        </div>
        <div>
          <label>Amount Paid Last Year:</label>
          <input type="text" value={formData.amountPaidLastYear} readOnly />
        </div>
        <div>
          <label>Amount Paid:</label>
          <input type="number" value={formData.amountPaid} onChange={e => handleInputChange('amountPaid', e.target.value)} required />
        </div>
        <div>
          <label>Year of Payment:</label>
          <input type="text" value={formData.yearOfPayment} readOnly />
        </div>
        <div>
          <label>Payment Mode:</label>
          <select
            value={formData.paymentMode}
            onChange={e => {
              handleInputChange('paymentMode', e.target.value);
              setShowQR(false);
            }}
            required
          >
            <option value="">Select Payment Mode</option>
            <option value="Cash">Cash</option>
            <option value="QR">QR</option>
            <option value="Cheque">Cheque</option>
            <option value="DD">DD</option>
            <option value="NEFT">NEFT</option>
          </select>
        </div>

        {formData.paymentMode === 'QR' && (
          <div>
            <button
              type="button"
              onClick={() => setShowQR(!showQR)}
              style={{ marginTop: '10px', marginBottom: '10px' }}
            >
              {showQR ? 'Hide QR' : 'Show QR'}
            </button>
            {showQR && (
              <div style={{ marginTop: '10px' }}>
                <img
                  src="https://api.qrserver.com/v1/create-qr-code/?data=PaymentQR&size=150x150"
                  alt="QR Code"
                />
              </div>
            )}
            <label>Reference Details (required):</label>
            <input
              type="text"
              value={formData.referenceDetails}
              onChange={e => handleInputChange('referenceDetails', e.target.value)}
              required
            />
          </div>
        )}

        {(formData.paymentMode === 'Cheque' || formData.paymentMode === 'DD') && (
          <div>
            <label>Reference Details:</label>
            <input type="text" value={formData.referenceDetails} onChange={e => handleInputChange('referenceDetails', e.target.value)} required />
          </div>
        )}

        {formData.paymentMode === 'NEFT' && (
          <div>
            <label>UTR Number:</label>
            <input type="text" value={formData.utrNumber} onChange={e => handleInputChange('utrNumber', e.target.value)} required />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="submit" className="blue-btn">Save Transaction</button>
          <button
            type="button"
            className="blue-btn"
            onClick={() => {
              setReceiptData(buildReceiptData(formData, ''));
              setShowReceiptModal(true);
            }}
          >
            Preview Receipt
          </button>
          {showCreateButton && (
            <button type="button" className="green-btn" onClick={handleCreateNewRecord}>
              Create New Entry
            </button>
          )}
          {formData.houseNo && (
            <button
              type="button"
              className="red-btn"
              onClick={() => setShowConfirmInactive(true)}
            >
              Mark as Inactive
            </button>
          )}
        </div>
      </form>

      {/* No entry modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <p>Either No entry found in the database for the entered house number or the user does not have access to see other house numbers.</p>
            <button onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Final confirmation modal for marking as inactive */}
      {showConfirmInactive && (
        <div className="modal-overlay">
          <div className="modal-content">
            <p>
              Are you sure you want to mark <b>{formData.houseNo}</b> as inactive?
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                className="red-btn"
                onClick={async () => {
                  setShowConfirmInactive(false);
                  await handleToggleInactive();
                }}
              >
                Yes, Mark as Inactive
              </button>
              <button
                className="blue-btn"
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
  <div className="modal-overlay" style={{ background: "rgba(0,0,0,0.16)" }}>
    <div className="modal-content receipt-modal">
      <div className="receipt-preview-container">
        <div className="receipt-header">
          <div className="receipt-title">Sarbojanin Durgotsab 2024</div>
          <div className="receipt-org">
            Organised by:
            <div className="receipt-org-main">
              Lake Gardens People's Association
            </div>
          </div>
          <div className="receipt-org-address">
            At Bangur Park, B-202, Lake Gardens, Kolkata - 700 045
          </div>
        </div>
        <hr className="receipt-hr" />

        <div className="receipt-row-flex" style={{marginBottom: "7px"}}>
          <div className="receipt-label">Receipt No: <span className="receipt-value">{receiptData.receiptNo || '[To be assigned]'}</span></div>
          <div className="receipt-label">Date: <span className="receipt-value">{receiptData.date}</span></div>
        </div>

        <div className="receipt-label">
          Received with thanks from: 
          <span className="receipt-value"> {receiptData.name}</span>
        </div>
        <div className="receipt-label">
          Of
          <span className="receipt-value"> {receiptData.address}</span>
        </div>

        <div className="receipt-label">
          The sum of Rupees:
          <span className="receipt-bold-indented">
              {receiptData.amountWords} only
          </span>
        </div>

        <div className="receipt-row-flex" style={{marginTop: "6px"}}>
          <div className="receipt-label">Amount (₹): <span className="receipt-value">{receiptData.amountFigure}</span></div>
          <div className="receipt-label">Mode: <span className="receipt-value">{receiptData.paymentMode}</span></div>
        </div>

        {receiptData.chequeOrDDNo && (
          <div className="receipt-field">
            Reference/UTR No: <span className="receipt-bold-indented">{receiptData.chequeOrDDNo}</span>
          </div>
        )}

        <div className="receipt-purpose">
          as subscription/donation for Sri Sri Durga Puja, Laxmi Puja and Kali Puja 2024
        </div>
        <div className="receipt-collector">
          Collector: <span>{receiptData.collector}</span>
        </div>
      </div>
      <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
        <button onClick={() => setShowReceiptModal(false)} className="blue-btn">Close</button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}

export default FormComponent;
