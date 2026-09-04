// src/Components/LoginPage.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from './Constants.jsx';
import {
  LOGIN_BLOCK_OPTIONS,
  FORM_BLOCK_OPTIONS,
  OUTSIDE_BLOCK,
  SOCIETY_BLOCKS,
  blockLabel,
} from './blockAccess.js';

const BLOCK_OPTIONS = LOGIN_BLOCK_OPTIONS;

export default function LoginPage({ onLogin }) {

  const navigate = useNavigate();
  /** active tab ---------------------------------------------------------------- */
  const [activeTab, setActiveTab] = useState('login');

  /** login state ---------------------------------------------------------------- */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  /** admin stuff ---------------------------------------------------------------- */
  const [masterPassword, setMasterPassword] = useState('');
  const emptyUser = { email: '', password: '', blocks: [], name: '', collectionBlock: '' };
  const [newUser, setNewUser] = useState({ ...emptyUser });

  const [updateUser, setUpdateUser] = useState({
    ...emptyUser,
  });

  const [loading, setLoading] = useState(false);

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

      const hadSociety = prev.blocks.some(b => SOCIETY_BLOCKS.includes(b) || b === 'ALLBLOCKS');
      const hasSociety = nextBlocks.some(b => SOCIETY_BLOCKS.includes(b) || b === 'ALLBLOCKS');
      if (
        !hadSociety &&
        hasSociety &&
        option !== OUTSIDE_BLOCK &&
        !nextBlocks.includes(OUTSIDE_BLOCK) &&
        !nextBlocks.includes('ALLBLOCKS')
      ) {
        nextBlocks = [...nextBlocks, OUTSIDE_BLOCK];
      }

      return { ...prev, blocks: nextBlocks };

    });
  };

  const isAdmin = () => masterPassword === 'masterpassword123';

  const renderNameAndCollectionFields = (user, setter) => (
    <>
      <input
        type="text"
        placeholder="Name"
        className="input-neon"
        value={user.name}
        onChange={e => setter(prev => ({ ...prev, name: e.target.value }))}
      />

      <div>
        <p className="text-sm text-slate-600 mb-2">Collection for the block</p>
        <p className="text-xs text-slate-400 mb-2">
          Combined collections from every block this user can access are counted under this block.
        </p>
        <div className="flex flex-wrap gap-2">
          {FORM_BLOCK_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setter(prev => ({ ...prev, collectionBlock: opt }))}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                user.collectionBlock === opt
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-glow'
                  : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {blockLabel(opt)}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  // Load a user's existing blocks so they appear pre-checked in the Update tab
  const loadUserBlocks = async (emailToLoad) => {
    const target = (emailToLoad || '').trim();
    if (!target) return;
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/user-blocks`, {
        params: { email: target }
      });
      if (data.found) {
        setUpdateUser(prev => ({
          ...prev,
          blocks: Array.isArray(data.blocks) ? data.blocks : [],
          name: data.name || '',
          collectionBlock: data.collectionBlock || '',
        }));
      }
    } catch (err) {
      console.error('Could not load user blocks:', err);
    }
  };

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* LOGIN                                                                       */
  /* ──────────────────────────────────────────────────────────────────────────── */

  const handleLogin = async e => {
    e.preventDefault();

    setLoading(true); // 🔥 START LOADER

    try {
      // ✅ ADMIN LOGIN
      if (email === "admin@sdapp.com" && password === "admin123") {
        onLogin(email, ["ALLBLOCKS"]);
        navigate("/admin-config");
        return;
      }

      const { data } = await axios.post(`${API_BASE_URL}/api/login`, { email, password });

      if (data.success) {
        onLogin(email, data.allowedBlocks ?? []);
        navigate("/home");
      } else {
        alert('Invalid credentials. Please try again.');
      }

    } catch (err) {
      console.error('Login error:', err);
      alert('Error logging in.');
    } finally {
      setLoading(false); // 🔥 STOP LOADER
    }
  };

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* ADD USER                                                                    */
  /* ──────────────────────────────────────────────────────────────────────────── */

  const handleAddUser = async () => {

    if (!isAdmin()) return alert('Incorrect master password.');
    if (!newUser.name.trim()) return alert('Please enter the collector name.');
    if (!newUser.collectionBlock) return alert('Please select Collection for the block.');
    if (!newUser.email || !newUser.password) return alert('Please enter both email and password.');
    if (newUser.blocks.length === 0) return alert('Select at least one block (or ALLBLOCKS).');

    setLoading(true); // 🔥 START LOADER

    try {

      const { data } = await axios.post(`${API_BASE_URL}/api/add-user`, {
        email: newUser.email,
        password: newUser.password,
        blocks: newUser.blocks,
        name: newUser.name,
        collectionBlock: newUser.collectionBlock,
      });

      if (data.success) {
        alert('User created!');
        setNewUser({ ...emptyUser });
        setMasterPassword('');
      } else {
        alert(data.message || 'Failed to add user.');
      }

    } catch (err) {
      console.error('add-user error', err);
      alert('Server error while adding user.');
    } finally {
      setLoading(false); // 🔥 STOP LOADER
    }
  };

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* UPDATE USER                                                                 */
  /* ──────────────────────────────────────────────────────────────────────────── */

  const handleUpdateUser = async () => {

    if (!isAdmin()) return alert('Incorrect master password.');
    if (!updateUser.name.trim()) return alert('Please enter the collector name.');
    if (!updateUser.collectionBlock) return alert('Please select Collection for the block.');
    if (!updateUser.email || !updateUser.password) return alert('Please enter email + new password.');
    if (updateUser.blocks.length === 0) return alert('Select at least one block (or ALLBLOCKS).');

    setLoading(true); // 🔥 START LOADER

    try {

      const { data } = await axios.post(`${API_BASE_URL}/api/update-user`, {
        email: updateUser.email,
        password: updateUser.password,
        blocks: updateUser.blocks,
        name: updateUser.name,
        collectionBlock: updateUser.collectionBlock,
      });

      if (data.success) {
        alert('User updated.');
        setUpdateUser({ ...emptyUser });
        setMasterPassword('');
      } else {
        alert(data.message || 'Failed to update user.');
      }

    } catch (err) {
      console.error('update-user error', err);
      alert('Server error while updating user.');
    } finally {
      setLoading(false); // 🔥 STOP LOADER
    }
  };



  /* ──────────────────────────────────────────────────────────────────────────── */
  /* RENDER                                                                      */
  /* ──────────────────────────────────────────────────────────────────────────── */

  return (
  <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden px-4 py-8">

    {/* Ambient animated glow blobs */}
    <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-400/25 blur-3xl animate-floatBlob" />
    <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-indigo-400/25 blur-3xl animate-floatBlob" style={{ animationDelay: '4s' }} />
    <div className="pointer-events-none absolute inset-0 bg-grid-faint [background-size:48px_48px] opacity-40" />

    <div className="relative w-full max-w-5xl grid md:grid-cols-2 rounded-3xl overflow-hidden glass shadow-neon">

      {/* LEFT SIDE (INFO PANEL) */}
      <div className="hidden md:flex relative bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-600 text-white p-10 flex-col justify-center overflow-hidden">
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-sky-300/40 blur-2xl animate-glowPulse" />

        <span className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs uppercase tracking-[0.3em] text-blue-50">
          Portal
        </span>
        <h1 className="text-5xl font-bold mb-4 leading-tight">
          SD<span className="text-sky-200">App</span>
        </h1>
        <p className="text-lg mb-4 text-blue-50">
          Sarbojanin Durgotsab Management System
        </p>

        <p className="text-sm text-blue-100 mb-6 leading-relaxed">
          Manage subscriptions, donations, and receipts for Durga Puja with ease.
          A complete digital platform for community celebration.
        </p>

        <ul className="space-y-3 text-sm">
          {['Digital Receipt Generation', 'Subscription Tracking', 'Block-based Access Control', 'Admin Dashboard'].map(item => (
            <li key={item} className="flex items-center gap-3 text-blue-50">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white text-xs shadow-[0_0_12px_rgba(255,255,255,0.4)]">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* RIGHT SIDE (FORM) */}
      <div className="flex items-center justify-center p-6 md:p-10 bg-white/70">
        <div className="w-full max-w-md">

          {/* HEADER */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold neon-text">Welcome</h2>
            <p className="text-sm text-slate-500 mt-1">Login to continue</p>
          </div>

          {/* TABS */}
          <div className="flex mb-6 p-1 rounded-xl bg-slate-100 border border-slate-200">
            {['login', 'add', 'update'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-300 ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-glow'
                    : 'text-slate-600 hover:text-blue-700'
                }`}
              >
                {tab === 'login'
                  ? 'Login'
                  : tab === 'add'
                  ? 'Add User'
                  : 'Update User'}
              </button>
            ))}
          </div>

          {/* LOGIN TAB */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4 animate-fadeIn">

              <div>
                <label className="text-sm text-slate-600">Email</label>
                <input
                  type="email"
                  className="input-neon mt-1"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-sm text-slate-600">Password</label>
                <input
                  type="password"
                  className="input-neon mt-1"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-neon w-full"
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </button>

            </form>
          )}

          {/* ADD USER TAB */}
          {activeTab === 'add' && (
            <div className="space-y-3 animate-fadeIn">

              <h3 className="text-lg font-semibold text-slate-800">Add User</h3>

              <input
                type="password"
                placeholder="Master Password"
                className="input-neon"
                value={masterPassword}
                onChange={e => setMasterPassword(e.target.value)}
              />

              {renderNameAndCollectionFields(newUser, setNewUser)}

              <input
                type="email"
                placeholder="Email"
                className="input-neon"
                value={newUser.email}
                onChange={e =>
                  setNewUser(prev => ({ ...prev, email: e.target.value }))
                }
              />

              <input
                type="password"
                placeholder="Password"
                className="input-neon"
                value={newUser.password}
                onChange={e =>
                  setNewUser(prev => ({ ...prev, password: e.target.value }))
                }
              />

              <div>
                <p className="text-sm text-slate-600 mb-2">Allowed Blocks</p>
                <p className="text-xs text-slate-400 mb-2">
                  Outside is for donors who live outside the society. It is added automatically with A–D and can be turned off.
                </p>
                <div className="flex flex-wrap gap-2">
                  {BLOCK_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleBlock(setNewUser)(opt)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                        newUser.blocks.includes(opt)
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-glow'
                          : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {blockLabel(opt)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleAddUser}
                disabled={loading}
                className="btn-neon w-full"
              >
                {loading ? "Creating..." : "Create User"}
              </button>

            </div>
          )}

          {/* UPDATE USER TAB */}
          {activeTab === 'update' && (
            <div className="space-y-3 animate-fadeIn">

              <h3 className="text-lg font-semibold text-slate-800">Update User</h3>

              <input
                type="password"
                placeholder="Master Password"
                className="input-neon"
                value={masterPassword}
                onChange={e => setMasterPassword(e.target.value)}
              />

              {renderNameAndCollectionFields(updateUser, setUpdateUser)}

              <input
                type="email"
                placeholder="Email"
                className="input-neon"
                value={updateUser.email}
                onChange={e =>
                  setUpdateUser(prev => ({ ...prev, email: e.target.value }))
                }
                onBlur={e => loadUserBlocks(e.target.value)}
              />

              <input
                type="password"
                placeholder="New Password"
                className="input-neon"
                value={updateUser.password}
                onChange={e =>
                  setUpdateUser(prev => ({ ...prev, password: e.target.value }))
                }
              />

              <div>
                <p className="text-sm text-slate-600 mb-2">
                  Allowed Blocks <span className="text-slate-400">(existing access is pre-selected)</span>
                </p>
                <p className="text-xs text-slate-400 mb-2">
                  Outside is for donors who live outside the society. It is added automatically with A–D and can be turned off.
                </p>
                <div className="flex flex-wrap gap-2">
                  {BLOCK_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleBlock(setUpdateUser)(opt)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                        updateUser.blocks.includes(opt)
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-glow'
                          : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {blockLabel(opt)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleUpdateUser}
                disabled={loading}
                className="btn-neon w-full !from-indigo-600 !to-violet-600"
              >
                {loading ? "Updating..." : "Update User"}
              </button>

            </div>
          )}

        </div>
      </div>
    </div>
  </div>
);
}