import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "./Constants";

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
    <div style={{ padding: "40px" }}>
      <h2>Admin Receipt Configuration</h2>

      <input placeholder="President"
        value={form.president}
        onChange={e => handleChange("president", e.target.value)}
      />

      <input placeholder="Jt Secretary 1"
        value={form.secretary1}
        onChange={e => handleChange("secretary1", e.target.value)}
      />

      <input placeholder="Jt Secretary 2"
        value={form.secretary2}
        onChange={e => handleChange("secretary2", e.target.value)}
      />

      <input placeholder="Treasurer"
        value={form.treasurer}
        onChange={e => handleChange("treasurer", e.target.value)}
      />

      <button onClick={handleSubmit}>Save</button>
    </div>
  );
}

export default AdminConfig;