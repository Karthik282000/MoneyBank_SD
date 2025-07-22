import React, { useState } from 'react';
import './App.css';
import LoginPage from './Components/LoginPage.jsx';
import Home from './Components/Home.jsx';
import FormComponent from './Components/FormComponents.jsx';
import SearchPeople from './Components/SearchPeople.jsx';

function App() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [allowedBlocks, setAllowedBlocks] = useState([]);

  const handleLogin = (email, blocks = []) => {
    setLoggedInUser(email);
    setAllowedBlocks(blocks);
    setActiveTab('home'); // Go to home after login
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Home allowedBlocks={allowedBlocks}/>;
      case 'paySubscription':
        return <FormComponent allowedBlocks={allowedBlocks} />;
      case 'searchPeople':
        return <SearchPeople allowedBlocks={allowedBlocks} />;
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
        <h2>Welcome, <span style={{fontWeight: "bold"}}>{loggedInUser}!</span></h2>
      </div>
      <div className="tabs">
        <button
          className={activeTab === 'home' ? 'active' : ''}
          onClick={() => setActiveTab('home')}
        >
          Home
        </button>
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
      {/* Render content below the tabs */}
      <div className="content">{renderContent()}</div>
    </div>
  );
}

export default App;
