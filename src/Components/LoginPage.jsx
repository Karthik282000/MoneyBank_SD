// src/Components/LoginPage.jsx
import React, { useState } from 'react';
import axios from 'axios';
import './LoginPage.css';

function LoginPage({ onLogin }) {
  const [activeTab, setActiveTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [newUser, setNewUser] = useState({ email: '', password: '' });
  const [updateUser, setUpdateUser] = useState({ email: '', password: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/api/login', { email, password });
      if (response.data.success) {
        onLogin(email);
      } else {
        alert('Invalid credentials. Please try again or click on add user to add the user of your choice');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Error logging in. Please try again.');
    }
  };

  const handleAddUser = async () => {
    if (masterPassword !== 'masterpassword123') {
      alert('Incorrect master password.');
      return;
    }
    if (!newUser.email || !newUser.password) {
      alert('Please enter both email and password.');
      return;
    }
    try {
      const response = await axios.post('http://localhost:5000/api/add-user', newUser);
      if (response.data.success) {
        alert('New user added successfully!');
        setNewUser({ email: '', password: '' });
        setMasterPassword('');
      } else {
        alert('Failed to add user.');
      }
    } catch (err) {
      console.error('Error adding user:', err);
      alert('Error adding user.');
    }
  };

  const handleUpdateUser = async () => {
    if (masterPassword !== 'masterpassword123') {
      alert('Incorrect master password.');
      return;
    }
    if (!updateUser.email || !updateUser.password) {
      alert('Please enter both email and new password.');
      return;
    }
    try {
      const response = await axios.post('http://localhost:5000/api/update-user', updateUser);
      if (response.data.success) {
        alert('User updated successfully!');
        setUpdateUser({ email: '', password: '' });
        setMasterPassword('');
      } else {
        alert('Failed to update user.');
      }
    } catch (err) {
      console.error('Error updating user:', err);
      alert('Error updating user.');
    }
  };

  return (
    <div className="login-container">
      <h2>Welcome</h2>
      <div className="button-group">
        <button
          className={activeTab === 'login' ? 'active' : ''}
          onClick={() => setActiveTab('login')}
        >
          Login
        </button>
        <button
          className={activeTab === 'add' ? 'active' : ''}
          onClick={() => setActiveTab('add')}
        >
          Add User
        </button>
        <button
          className={activeTab === 'update' ? 'active' : ''}
          onClick={() => setActiveTab('update')}
        >
          Update User
        </button>
      </div>

      {activeTab === 'login' && (
        <form onSubmit={handleLogin}>
          <div>
            <label>Email:</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Password:</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit">Login</button>
        </form>
      )}

      {activeTab === 'add' && (
        <div className="add-user-container">
          <h3>Add New User</h3>
          <div>
            <label>Master Password:</label>
            <input
              type="password"
              placeholder="Enter master password"
              value={masterPassword}
              onChange={e => setMasterPassword(e.target.value)}
            />
          </div>
          <div>
            <label>New User Email:</label>
            <input
              type="email"
              placeholder="Enter new user email"
              value={newUser.email}
              onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div>
            <label>New User Password:</label>
            <input
              type="password"
              placeholder="Enter new user password"
              value={newUser.password}
              onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))}
            />
          </div>
          <button type="button" onClick={handleAddUser}>
            Create User
          </button>
        </div>
      )}

      {activeTab === 'update' && (
        <div className="update-user-container">
          <h3>Update User</h3>
          <div>
            <label>Master Password:</label>
            <input
              type="password"
              placeholder="Enter master password"
              value={masterPassword}
              onChange={e => setMasterPassword(e.target.value)}
            />
          </div>
          <div>
            <label>New Email:</label>
            <input
              type="email"
              placeholder="Enter new email"
              value={updateUser.email}
              onChange={e => setUpdateUser(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div>
            <label>New Password:</label>
            <input
              type="password"
              placeholder="Enter new password"
              value={updateUser.password}
              onChange={e => setUpdateUser(prev => ({ ...prev, password: e.target.value }))}
            />
          </div>
          <button type="button" onClick={handleUpdateUser}>
            Update User
          </button>
        </div>
      )}
    </div>
  );
}

export default LoginPage;
