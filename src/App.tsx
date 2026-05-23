import { useState, useEffect, useCallback } from 'react';
import { useUser, useClerk, SignIn, SignUp } from '@clerk/clerk-react';
import type { Transaction, Period, DateRange } from './types';
import { loadTransactions, addTransaction, updateTransaction, deleteTransaction, generateId } from './storage';
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
  const { isSignedIn, user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [period, setPeriod] = useState<Period>('all');
  const [customRange, setCustomRange] = useState<DateRange>({ start: '', end: '' });
  const [activePage, setActivePage] = useState<'dashboard' | 'report' | 'account'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);

  const notify = useCallback((type: Alert['type'], message: string) => {
    const id = generateId();
    setAlerts(a => [...a, { id, type, message }]);
    setTimeout(() => setAlerts(a => a.filter(x => x.id !== id)), 3000);
  }, []);

  useEffect(() => {
    if (isSignedIn && user) {
      setLoading(true);
      loadTransactions(user.id).then(data => {
        setTransactions(data);
        setLoading(false);
      });
    }
  }, [isSignedIn, user]);

  async function handleAdd(t: Transaction) {
    if (!user) return;
    const ok = await addTransaction(user.id, t);
    if (ok) {
      setTransactions(prev => [t, ...prev]);
      notify('success', 'Transaksi ditambahkan');
    } else {
      notify('error', 'Gagal menambah transaksi');
    }
  }

  async function handleEdit(t: Transaction) {
    if (!user) return;
    const ok = await updateTransaction(user.id, t);
    if (ok) {
      setTransactions(prev => prev.map(x => x.id === t.id ? t : x));
      notify('success', 'Transaksi diupdate');
    } else {
      notify('error', 'Gagal update transaksi');
    }
  }

  async function handleDelete(id: string) {
    if (!user) return;
    const ok = await deleteTransaction(user.id, id);
    if (ok) {
      setTransactions(prev => prev.filter(x => x.id !== id));
      notify('success', 'Transaksi dihapus');
    } else {
      notify('error', 'Gagal hapus transaksi');
    }
  }

  async function handleLogout() {
    await signOut();
    setTransactions([]);
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">KENZAI AGENT</h1>
            <p className="text-sm text-gray-400 mt-1">powered by NATA</p>
            <p className="text-xs text-gray-500 mt-4">Smart Money Management Dashboard</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl shadow-black/20">
            <div className="flex bg-gray-800 rounded-xl p-1 mb-6">
              <button onClick={() => setAuthMode('login')}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${authMode === 'login' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' : 'text-gray-400 hover:text-gray-200'}`}>
                Masuk
              </button>
              <button onClick={() => setAuthMode('register')}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${authMode === 'register' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' : 'text-gray-400 hover:text-gray-200'}`}>
                Daftar
              </button>
            </div>

            <div className="clerk-container">
              {authMode === 'login' ? (
                <SignIn appearance={{
                  elements: {
                    rootBox: 'w-full',
                    card: 'bg-transparent shadow-none p-0 border-0',
                    headerTitle: 'hidden',
                    headerSubtitle: 'hidden',
                    socialButtonsBlockButton: 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-200',
                    formFieldInput: 'bg-gray-800 border-gray-700 text-gray-100 focus:border-teal-500 rounded-lg',
                    formFieldLabel: 'text-gray-400 text-xs',
                    formButtonPrimary: 'bg-teal-600 hover:bg-teal-500 rounded-lg shadow-lg shadow-teal-600/20',
                    footerAction: 'hidden',
                    dividerLine: 'bg-gray-700',
                    dividerText: 'text-gray-500',
                    identityPreview: 'bg-gray-800 border-gray-700',
                    identityPreviewText: 'text-gray-300',
                    identityPreviewEditButton: 'text-teal-400',
                    formFieldAction: 'text-teal-400',
                    alert: 'bg-red-900/50 border-red-800 text-red-300',
                  }
                }} />
              ) : (
                <SignUp appearance={{
                  elements: {
                    rootBox: 'w-full',
                    card: 'bg-transparent shadow-none p-0 border-0',
                    headerTitle: 'hidden',
                    headerSubtitle: 'hidden',
                    socialButtonsBlockButton: 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-200',
                    formFieldInput: 'bg-gray-800 border-gray-700 text-gray-100 focus:border-teal-500 rounded-lg',
                    formFieldLabel: 'text-gray-400 text-xs',
                    formButtonPrimary: 'bg-teal-600 hover:bg-teal-500 rounded-lg shadow-lg shadow-teal-600/20',
                    footerAction: 'hidden',
                    dividerLine: 'bg-gray-700',
                    dividerText: 'text-gray-500',
                    alert: 'bg-red-900/50 border-red-800 text-red-300',
                  }
                }} />
              )}
            </div>
          </div>

          <p className="text-center text-xs text-gray-600 mt-6">Secure authentication by Clerk</p>
        </div>

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
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {alerts.map(a => (
          <div key={a.id} className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            a.type === 'success' ? 'bg-teal-600' : a.type === 'error' ? 'bg-red-600' : 'bg-yellow-600'
          }`}>{a.message}</div>
        ))}
      </div>

      <Sidebar activePage={activePage} setActivePage={setActivePage} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0">
        <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div>
                <h2 className="text-lg font-semibold text-white">{activePage === 'dashboard' ? 'Dashboard' : activePage === 'report' ? 'Cetak Laporan' : 'Akun'}</h2>
                <p className="text-xs text-gray-400">{user?.primaryEmailAddress?.emailAddress}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 hidden sm:inline">{transactions.length} transaksi</span>
              <button onClick={handleLogout} className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors">
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 sm:px-6 lg:px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-3 text-sm text-gray-400">Memuat data...</span>
            </div>
          ) : activePage === 'dashboard' ? (
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
