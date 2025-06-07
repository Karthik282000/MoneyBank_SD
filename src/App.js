// src/App.js
import React, { useState } from 'react';
import './App.css';
import FormComponent from './Components/FormComponents.jsx';
import SearchPeople from './Components/SearchPeople.jsx';
import LoginPage from './Components/LoginPage.jsx';

function App() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [activeTab, setActiveTab] = useState('paySubscription');

  // Handler when user successfully logs in
  const handleLogin = (email) => {
    setLoggedInUser(email);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'paySubscription':
        return <FormComponent />;
      case 'searchPeople':
        return <SearchPeople />;
      default:
        return null;
    }
  };

  if (!loggedInUser) {
    return (
      <div className="App">
        <LoginPage onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="App">
      <div className="header">
        <h2>Welcome, {loggedInUser}!</h2>
        <div className="tabs">
          <button
            className={activeTab === 'paySubscription' ? 'active' : ''}
            onClick={() => setActiveTab('paySubscription')}
          >
            Pay Subscription
          </button>
          <button
            className={activeTab === 'searchPeople' ? 'active' : ''}
            onClick={() => setActiveTab('searchPeople')}
          >
            Search People
          </button>
        </div>
      </div>
      <div className="content">{renderContent()}</div>
    </div>
  );
}

export default App;
