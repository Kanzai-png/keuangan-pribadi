import { useState, useEffect, useCallback } from 'react';
import type { Transaction, Period, DateRange } from './types';
import {
  loadTransactions, addTransaction, updateTransaction, deleteTransaction,
  signUp, signIn, signOut, getSession, generateId
} from './storage';
import { supabase } from './supabase';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import Report from './Report';
import Account from './Account';

interface Alert {
  id: string;
  type: 'success' | 'error' | 'warning';
  message: string;
}

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [period, setPeriod] = useState<Period>('all');
  const [customRange, setCustomRange] = useState<DateRange>({ start: '', end: '' });
  const [activePage, setActivePage] = useState<'dashboard' | 'report' | 'account'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);

  const notify = useCallback((type: Alert['type'], message: string) => {
    const id = generateId();
    setAlerts(a => [...a, { id, type, message }]);
    setTimeout(() => setAlerts(a => a.filter(x => x.id !== id)), 3000);
  }, []);

  useEffect(() => {
    // Check existing session
    getSession().then(session => {
      if (session?.user) {
        setUser(session.user);
        loadTransactions().then(data => {
          setTransactions(data);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        loadTransactions().then(setTransactions);
      } else {
        setUser(null);
        setTransactions([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (authMode === 'register') {
        await signUp(authForm.email, authForm.password);
        notify('success', 'Registrasi berhasil! Cek email untuk verifikasi.');
      } else {
        await signIn(authForm.email, authForm.password);
        notify('success', 'Login berhasil');
      }
    } catch (err: any) {
      notify('error', err.message || 'Auth gagal');
    }
    setAuthLoading(false);
  }

  async function handleLogout() {
    await signOut();
    setUser(null);
    setTransactions([]);
    notify('success', 'Logged out');
  }

  async function handleAdd(t: Transaction) {
    const ok = await addTransaction(t);
    if (ok) {
      setTransactions(prev => [t, ...prev]);
      notify('success', 'Transaksi ditambahkan');
    } else {
      notify('error', 'Gagal menyimpan');
    }
  }

  async function handleEdit(t: Transaction) {
    const ok = await updateTransaction(t);
    if (ok) {
      setTransactions(prev => prev.map(x => x.id === t.id ? t : x));
      notify('success', 'Transaksi diupdate');
    } else {
      notify('error', 'Gagal update');
    }
  }

  async function handleDelete(id: string) {
    const ok = await deleteTransaction(id);
    if (ok) {
      setTransactions(prev => prev.filter(x => x.id !== id));
      notify('success', 'Transaksi dihapus');
    } else {
      notify('error', 'Gagal hapus');
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading...</div>;

  // Auth screen
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white">KENZAI AGENT</h1>
            <p className="text-sm text-gray-400 mt-1">powered by NATA</p>
            <p className="text-xs text-gray-500 mt-3">Money Management Dashboard</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex mb-6">
              <button onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${authMode === 'login' ? 'bg-teal-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                Login
              </button>
              <button onClick={() => setAuthMode('register')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${authMode === 'register' ? 'bg-teal-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                Register
              </button>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <input type="email" value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com" required
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Password</label>
                <input type="password" value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min 6 karakter" required minLength={6}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
              </div>
              <button type="submit" disabled={authLoading}
                className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-sm font-medium disabled:opacity-50">
                {authLoading ? 'Loading...' : authMode === 'login' ? 'Login' : 'Register'}
              </button>
            </form>
          </div>
        </div>
        {/* Alerts */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {alerts.map(a => (
            <div key={a.id} className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
              a.type === 'success' ? 'bg-teal-600' : a.type === 'error' ? 'bg-red-600' : 'bg-yellow-600'
            }`}>{a.message}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      {/* Alerts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {alerts.map(a => (
          <div key={a.id} className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            a.type === 'success' ? 'bg-teal-600' : a.type === 'error' ? 'bg-red-600' : 'bg-yellow-600'
          }`}>{a.message}</div>
        ))}
      </div>

      {/* Sidebar */}
      <Sidebar activePage={activePage} setActivePage={setActivePage} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Top Bar */}
        <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div>
                <h2 className="text-lg font-semibold text-white">{activePage === 'dashboard' ? 'Dashboard' : activePage === 'report' ? 'Cetak Laporan' : 'Akun'}</h2>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">{transactions.length} transaksi</span>
              <button onClick={handleLogout} className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700">
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="px-4 sm:px-6 lg:px-8 py-6">
          {activePage === 'dashboard' ? (
            <Dashboard
              transactions={transactions}
              period={period}
              customRange={customRange}
              setPeriod={setPeriod}
              setCustomRange={setCustomRange}
              onAdd={handleAdd}
              onEdit={handleEdit}
              onDelete={handleDelete}
              notify={notify}
            />
          ) : activePage === 'report' ? (
            <Report
              transactions={transactions}
              period={period}
              customRange={customRange}
              setPeriod={setPeriod}
              setCustomRange={setCustomRange}
              notify={notify}
            />
          ) : (
            <Account user={user} notify={notify} />
          )}
        </main>
      </div>
    </div>
  );
}
