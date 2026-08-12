import React, { useState, useEffect } from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import LoginPage from './Components/LoginPage.jsx';
import Home from './Components/Home.jsx';
import FormComponent from './Components/FormComponents.jsx';
import SearchPeople from './Components/SearchPeople.jsx';
import AdminConfig from "./Components/AdminConfig.jsx";
import DashboardLayout from "./Layout/DashboardLayout.jsx";

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

  // ✅ LOAD FROM LOCAL STORAGE (IMPORTANT FIX)
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedBlocks = localStorage.getItem("allowedBlocks");

    if (storedUser) {
      setLoggedInUser(storedUser);
      setAllowedBlocks(JSON.parse(storedBlocks || "[]"));
    }
  }, []);

  const handleLogin = (email, blocks = []) => {
    setLoggedInUser(email);
    setAllowedBlocks(blocks);

    // ✅ SAVE LOGIN
    localStorage.setItem("user", email);
    localStorage.setItem("allowedBlocks", JSON.stringify(blocks));

    navigate("/home");
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    setAllowedBlocks([]);

    localStorage.removeItem("user");
    localStorage.removeItem("allowedBlocks");

    navigate("/");
  };

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