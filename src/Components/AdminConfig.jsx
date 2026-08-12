import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "./Constants";
import { FiUser, FiUsers, FiBriefcase, FiSettings, FiSave } from "react-icons/fi";

function AdminConfig() {
  const [form, setForm] = useState({
    president: "",
    secretary1: "",
    secretary2: "",
    treasurer: ""
  });

  // Load existing values
  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/receipt-config`)
      .then(res => setForm(res.data))
      .catch(() => {});
  }, []);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    await axios.post(`${API_BASE_URL}/api/update-receipt-config`, form);
    alert("Fields updated successfully ✅");
  };

  return (
    <div className="relative w-full min-h-full p-4 md:p-8 overflow-hidden">

      {/* Ambient animated glow blobs */}
      <div className="pointer-events-none absolute -top-24 right-10 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl animate-floatBlob" />
      <div className="pointer-events-none absolute bottom-0 -left-24 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl animate-floatBlob" style={{ animationDelay: '5s' }} />

      <div className="relative mb-8 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-blue-500/80">Admin</p>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight neon-text">Receipt Configuration</h2>
        <div className="mx-auto mt-4 h-[2px] w-40 rounded-full bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-2xl glass-card overflow-hidden">

        {/* Gradient header banner */}
        <div className="relative flex items-center gap-4 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="pointer-events-none absolute -top-8 right-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <FiSettings className="text-2xl" />
          </div>
          <div>
            <h3 className="text-lg font-bold leading-tight">Committee Signatories</h3>
            <p className="text-sm text-blue-100">These names appear on every generated receipt.</p>
          </div>
        </div>

        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            <div>
              <label className="mb-2 flex items-center gap-2 text-slate-700 font-semibold">
                <FiUser className="text-blue-500" /> President
              </label>
              <input placeholder="President"
                className="input-neon"
                value={form.president}
                onChange={e => handleChange("president", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-slate-700 font-semibold">
                <FiBriefcase className="text-blue-500" /> Treasurer
              </label>
              <input placeholder="Treasurer"
                className="input-neon"
                value={form.treasurer}
                onChange={e => handleChange("treasurer", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-slate-700 font-semibold">
                <FiUsers className="text-blue-500" /> Jt Secretary 1
              </label>
              <input placeholder="Jt Secretary 1"
                className="input-neon"
                value={form.secretary1}
                onChange={e => handleChange("secretary1", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-slate-700 font-semibold">
                <FiUsers className="text-blue-500" /> Jt Secretary 2
              </label>
              <input placeholder="Jt Secretary 2"
                className="input-neon"
                value={form.secretary2}
                onChange={e => handleChange("secretary2", e.target.value)}
              />
            </div>

          </div>

          <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-slate-600">
            <span>Changes apply instantly to newly generated receipts.</span>
          </div>

          <button onClick={handleSubmit} className="btn-neon mt-6 w-full gap-2">
            <FiSave className="text-lg" />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminConfig;