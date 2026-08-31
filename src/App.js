import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import LoginPage from './Components/LoginPage.jsx';
import Home from './Components/Home.jsx';
import FormComponent from './Components/FormComponents.jsx';
import SearchPeople from './Components/SearchPeople.jsx';
import AdminConfig from "./Components/AdminConfig.jsx";
import DashboardLayout from "./Layout/DashboardLayout.jsx";
import { API_BASE_URL } from './Components/Constants.jsx';
import { withDefaultOutsideAccess } from './Components/blockAccess.js';

// Normalize allowed_blocks into a clean JS array regardless of how it arrives:
//   ['A','B']  |  '["A","B"]'  |  '{"A","B"}'  |  '{A,B}'  |  'A,B'
function parseBlocks(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value == null) return [];
  if (typeof value === 'string') {
    const s = value.trim();
    try {
      const j = JSON.parse(s);
      if (Array.isArray(j)) return j.filter(Boolean);
    } catch { /* not JSON — fall through to Postgres-array parsing */ }
    return s
      .replace(/^\{|\}$/g, '')
      .split(',')
      .map(x => x.replace(/["']/g, '').trim())
      .filter(Boolean);
  }
  return [];
}

function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  );
}

function App() {
  const navigate = useNavigate();

  const [loggedInUser, setLoggedInUser] = useState(null);
  const [allowedBlocks, setAllowedBlocks] = useState([]);
  // Gate rendering until we've validated any existing session, to avoid a flicker.
  const [authChecked, setAuthChecked] = useState(false);

  // Restore session on load. We use sessionStorage (cleared when the browser/tab
  // closes) AND re-validate against the server's boot id. If the server was
  // restarted (id changed) or is unreachable, the stored session is discarded
  // and the user must log in again.
  useEffect(() => {
    const storedUser = sessionStorage.getItem("user");
    const storedBlocks = sessionStorage.getItem("allowedBlocks");
    const storedSession = sessionStorage.getItem("serverSession");

    if (!storedUser) {
      setAuthChecked(true);
      return;
    }

    axios.get(`${API_BASE_URL}/api/auth/session`)
      .then(({ data }) => {
        if (data?.sessionId && data.sessionId === storedSession) {
          let restored = [];
          try { restored = parseBlocks(JSON.parse(storedBlocks)); }
          catch { restored = parseBlocks(storedBlocks); }
          setLoggedInUser(storedUser);
          setAllowedBlocks(restored);
        } else {
          sessionStorage.clear();
        }
      })
      .catch(() => {
        // Server unreachable / restarted → require a fresh login.
        sessionStorage.clear();
      })
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLogin = (email, blocks = []) => {
    const normalized = withDefaultOutsideAccess(parseBlocks(blocks));
    setLoggedInUser(email);
    setAllowedBlocks(normalized);

    sessionStorage.setItem("user", email);
    sessionStorage.setItem("allowedBlocks", JSON.stringify(normalized));

    // Capture the current server boot id so a later restart invalidates this session.
    axios.get(`${API_BASE_URL}/api/auth/session`)
      .then(({ data }) => sessionStorage.setItem("serverSession", data?.sessionId || ""))
      .catch(() => {});
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    setAllowedBlocks([]);

    sessionStorage.clear();

    navigate("/");
  };

  if (!authChecked) {
    return (
      <div className="App min-h-screen flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="App">

      {/* NOT LOGGED IN */}
      {!loggedInUser ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <DashboardLayout user={loggedInUser} onLogout={handleLogout}>
  <Routes>
    <Route path="/home" element={<Home allowedBlocks={allowedBlocks} />} />
    <Route path="/pay" element={<FormComponent allowedBlocks={allowedBlocks} />} />
    <Route path="/search" element={<SearchPeople allowedBlocks={allowedBlocks} />} />
    <Route path="/admin-config" element={<AdminConfig />} />
    <Route path="*" element={<Navigate to="/home" />} />
  </Routes>
</DashboardLayout>
      )}
    </div>
  );
}

export default AppWrapper;