// src/Components/LoginPage.jsx
import React, { useState } from 'react';
import axios from 'axios';
import './LoginPage.css';
import {API_BASE_URL} from './Constants.jsx'

const BLOCK_OPTIONS = ['A', 'B', 'C', 'D', 'ALLBLOCKS'];


export default function LoginPage({ onLogin }) {
  /** active tab ---------------------------------------------------------------- */
  const [activeTab, setActiveTab] = useState('login');

  /** login state ---------------------------------------------------------------- */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  /** admin stuff (master password + add / update) ------------------------------- */
  const [masterPassword, setMasterPassword] = useState('');
  const [newUser, setNewUser] = useState({ email: '', password: '', blocks: [] });
  const [updateUser, setUpdateUser] = useState({
    email: '',
    password: '',
    blocks: [],
  });

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* helpers                                                                     */
  /* ──────────────────────────────────────────────────────────────────────────── */
   const toggleBlock = setter => option => {
    setter(prev => {
      let nextBlocks = prev.blocks.includes(option)
        ? prev.blocks.filter(b => b !== option)
        : [...prev.blocks, option];

      if (nextBlocks.includes('ALLBLOCKS') && nextBlocks.length > 1) {
        nextBlocks = ['ALLBLOCKS'];
      }
      if (option !== 'ALLBLOCKS' && nextBlocks.includes('ALLBLOCKS')) {
        nextBlocks = nextBlocks.filter(b => b !== 'ALLBLOCKS');
      }

      return { ...prev, blocks: nextBlocks };
    });
  };

  const isAdmin = () => masterPassword === 'masterpassword123';

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* LOGIN                                                                       */
  /* ──────────────────────────────────────────────────────────────────────────── */
const handleLogin = async e => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/login`, { email, password });
      if (data.success) {
        localStorage.setItem('allowedBlocks', JSON.stringify(data.allowedBlocks ?? []));
        onLogin(email, data.allowedBlocks ?? []);
      } else {
        alert('Invalid credentials. Please try again or add the user via "Add User".');
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('Error logging in. Please try again.');
    }
  };


  /* ──────────────────────────────────────────────────────────────────────────── */
  /* ADD USER                                                                    */
  /* ──────────────────────────────────────────────────────────────────────────── */
 const handleAddUser = async () => {
    if (!isAdmin()) return alert('Incorrect master password.');
    if (!newUser.email || !newUser.password) return alert('Please enter both email and password.');
    if (newUser.blocks.length === 0) return alert('Select at least one block (or ALLBLOCKS).');

    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/add-user`, {
        email: newUser.email,
        password: newUser.password,
        blocks: newUser.blocks
      });
      if (data.success) {
        alert('User created!');
        setNewUser({ email: '', password: '', blocks: [] });
        setMasterPassword('');
      } else {
        alert(data.message || 'Failed to add user.');
      }
    } catch (err) {
      console.error('add-user error', err);
      alert('Server error while adding user.');
    }
  };


  /* ──────────────────────────────────────────────────────────────────────────── */
  /* UPDATE USER                                                                 */
  /* ──────────────────────────────────────────────────────────────────────────── */
   const handleUpdateUser = async () => {
    if (!isAdmin()) return alert('Incorrect master password.');
    if (!updateUser.email || !updateUser.password) return alert('Please enter email + new password.');
    if (updateUser.blocks.length === 0) return alert('Select at least one block (or ALLBLOCKS).');

    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/update-user`, {
        email: updateUser.email,
        password: updateUser.password,
        blocks: updateUser.blocks
      });
      if (data.success) {
        alert('User updated.');
        setUpdateUser({ email: '', password: '', blocks: [] });
        setMasterPassword('');
      } else {
        alert(data.message || 'Failed to update user.');
      }
    } catch (err) {
      console.error('update-user error', err);
      alert('Server error while updating user.');
    }
  };

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* RENDER                                                                      */
  /* ──────────────────────────────────────────────────────────────────────────── */
  return (
    <div className="login-container">
      <h2>Welcome</h2>

      {/* ---------------------------- tabs ------------------------------------ */}
      <div className="button-group">
        {['login', 'add', 'update'].map(tab => (
          <button
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'login'
              ? 'Login'
              : tab === 'add'
              ? 'Add User'
              : 'Update User'}
          </button>
        ))}
      </div>

      {/* ---------------------------- LOGIN ----------------------------------- */}
      {activeTab === 'login' && (
        <form onSubmit={handleLogin}>
          <div>
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Password:</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit">Login</button>
        </form>
      )}

      {/* ---------------------------- ADD USER -------------------------------- */}
      {activeTab === 'add' && (
        <section className="add-user-container">
          <h3>Add New User</h3>

          <div>
            <label>Master Password:</label>
            <input
              type="password"
              value={masterPassword}
              onChange={e => setMasterPassword(e.target.value)}
            />
          </div>

          <div>
            <label>Email:</label>
            <input
              type="email"
              value={newUser.email}
              onChange={e =>
                setNewUser(prev => ({ ...prev, email: e.target.value }))
              }
            />
          </div>

          <div>
            <label>Password:</label>
            <input
              type="password"
              value={newUser.password}
              onChange={e =>
                setNewUser(prev => ({ ...prev, password: e.target.value }))
              }
            />
          </div>

          {/* block check-boxes */}
          <div className="block-checkboxes">
            <label style={{ display: 'block' }}>Allowed Blocks:</label>
            {BLOCK_OPTIONS.map(opt => (
              <label key={opt}>
                <input
                  type="checkbox"
                  checked={newUser.blocks.includes(opt)}
                  onChange={() => toggleBlock(setNewUser)(opt)}
                  disabled={
                    newUser.blocks.includes('ALLBLOCKS') && opt !== 'ALLBLOCKS'
                  }
                />
                {opt}
              </label>
            ))}
          </div>

          <button onClick={handleAddUser}>Create User</button>
        </section>
      )}

      {/* ---------------------------- UPDATE USER ----------------------------- */}
      {activeTab === 'update' && (
        <section className="update-user-container">
          <h3>Update User</h3>

          <div>
            <label>Master Password:</label>
            <input
              type="password"
              value={masterPassword}
              onChange={e => setMasterPassword(e.target.value)}
            />
          </div>

          <div>
            <label>New Email:</label>
            <input
              type="email"
              value={updateUser.email}
              onChange={e =>
                setUpdateUser(prev => ({ ...prev, email: e.target.value }))
              }
            />
          </div>

          <div>
            <label>New Password:</label>
            <input
              type="password"
              value={updateUser.password}
              onChange={e =>
                setUpdateUser(prev => ({ ...prev, password: e.target.value }))
              }
            />
          </div>

          {/* block check-boxes */}
          <div className="block-checkboxes">
            <label style={{ display: 'block' }}>Allowed Blocks:</label>
            {BLOCK_OPTIONS.map(opt => (
              <label key={opt}>
                <input
                  type="checkbox"
                  checked={updateUser.blocks.includes(opt)}
                  onChange={() => toggleBlock(setUpdateUser)(opt)}
                  disabled={
                    updateUser.blocks.includes('ALLBLOCKS') &&
                    opt !== 'ALLBLOCKS'
                  }
                />
                {opt}
              </label>
            ))}
          </div>

          <button onClick={handleUpdateUser}>Update User</button>
        </section>
      )}
    </div>
  );
}
