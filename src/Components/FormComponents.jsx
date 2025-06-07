import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './FormComponents.css';

function FormComponent() {
  const [formData, setFormData] = useState({
    houseNo: '',
    name: '',
    contact: '',
    amountPaidLastYear: '',
    amountPaid: '',
    yearOfPayment: '',
    paymentMode: '',
    utrNumber: '',
    referenceDetails: ''
  });

  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [allData, setAllData] = useState([]);
  const [submitEnabled, setSubmitEnabled] = useState(true);
  const [showCreateButton, setShowCreateButton] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const dropdownRef = useRef(null);

  const fetchData = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/data');
      setAllData(response.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchFinancialYear = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/get-financial-year');
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
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleHouseNoChange = (value) => {
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
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleButtonClick = () => {
    const value = formData.houseNo.trim().toLowerCase();
    if (value) {
      const filtered = allData.filter(item =>
        item.houseno?.toLowerCase().startsWith(value)
      );
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

  const handleSelectSuggestion = (suggestion) => {
    setFormData(prev => ({
      houseNo: suggestion.houseno || '',
      name: suggestion.name || '',
      contact: suggestion.contact || '',
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
      await axios.post('http://localhost:5000/api/update-customer-state', {
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

  const handleSubmitTransaction = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        houseNo: formData.houseNo,
        name: formData.name,
        contact: formData.contact,
        block: formData.block,
        amountPaid: parseFloat(formData.amountPaid),
        yearOfPayment: formData.yearOfPayment,
        paymentMode: formData.paymentMode,
        utrNumber: formData.utrNumber,
        referenceDetails: formData.referenceDetails
      };
      await axios.post('http://localhost:5000/api/save-transaction', payload);
      alert('Transaction and details saved successfully!');
      fetchData();
      resetForm();
    } catch (error) {
      alert('Failed to save transaction. Please try again.');
    }
  };

  const handleCreateNewRecord = async () => {
    try {
      const payload = {
        houseNo: formData.houseNo,
        name: formData.name,
        contact: formData.contact,
        block: formData.block,
        amountPaid: parseFloat(formData.amountPaid),
        yearOfPayment: formData.yearOfPayment,
        paymentMode: formData.paymentMode,
        utrNumber: formData.utrNumber,
        referenceDetails: formData.referenceDetails
      };
      await axios.post('http://localhost:5000/api/create-new-house', payload);
      alert('New house entry and transaction created successfully!');
      fetchData();
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
      amountPaidLastYear: '',
      amountPaid: '',
      yearOfPayment: prev.yearOfPayment,
      paymentMode: '',
      utrNumber: '',
      referenceDetails: ''
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
          <button type="button" onClick={handleButtonClick}>Show Options</button>

          {showDropdown && filteredSuggestions.length > 0 && (
            <ul className="suggestions-dropdown" ref={dropdownRef}>
              {filteredSuggestions.map((suggestion, index) => (
                <li key={index} onClick={() => handleSelectSuggestion(suggestion)}>
                  {suggestion.houseno} - {suggestion.name} - {suggestion.contact}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div><label>Name:</label><input type="text" value={formData.name} onChange={e => handleInputChange('name', e.target.value)} /></div>
        <div><label>Contact:</label><input type="text" value={formData.contact} onChange={e => handleInputChange('contact', e.target.value)} required /></div>
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
        <div><label>Amount Paid Last Year:</label><input type="text" value={formData.amountPaidLastYear} readOnly /></div>
        <div><label>Amount Paid:</label><input type="number" value={formData.amountPaid} onChange={e => handleInputChange('amountPaid', e.target.value)} required /></div>
        <div><label>Year of Payment:</label><input type="text" value={formData.yearOfPayment} readOnly /></div>
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

        {formData.paymentMode !== 'QR' && (
          <>
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
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="submit" className="blue-btn">Save Transaction</button>
          {showCreateButton && (
            <button type="button" className="green-btn" onClick={handleCreateNewRecord}>
              Create New Entry
            </button>
          )}
          {formData.houseNo && <button type="button" className="red-btn" onClick={handleToggleInactive}>Mark as Inactive</button>}
        </div>
      </form>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <p>No entry found in the database for the entered house number.</p>
            <button onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FormComponent;
