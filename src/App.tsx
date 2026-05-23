import { useState, useEffect, useCallback } from 'react';
import type { Transaction, Period, DateRange } from './types';
import {
  loadFromGithub, saveToGithub, saveToLocal,
  generateId, getGithubToken, setGithubToken
} from './storage';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';

interface Alert {
  id: string;
  type: 'success' | 'error' | 'warning';
  message: string;
}

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [period, setPeriod] = useState<Period>('all');
  const [customRange, setCustomRange] = useState<DateRange>({ start: '', end: '' });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [synced, setSynced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const notify = useCallback((type: Alert['type'], message: string) => {
    const id = generateId();
    setAlerts(a => [...a, { id, type, message }]);
    setTimeout(() => setAlerts(a => a.filter(x => x.id !== id)), 3000);
  }, []);

  useEffect(() => {
    (async () => {
      const token = getGithubToken();
      if (token) {
        const data = await loadFromGithub();
        setTransactions(data);
        setSynced(true);
      } else {
        const local = localStorage.getItem('keuangan_transactions');
        setTransactions(local ? JSON.parse(local) : []);
      }
      setLoading(false);
    })();
  }, []);

  const save = useCallback(async (data: Transaction[]) => {
    setTransactions(data);
    saveToLocal(data);
    if (getGithubToken()) {
      const ok = await saveToGithub(data);
      setSynced(ok);
    }
  }, []);

  function handleAdd(t: Transaction) {
    save([t, ...transactions]);
  }

  function handleEdit(t: Transaction) {
    save(transactions.map(x => x.id === t.id ? t : x));
  }

  function handleDelete(id: string) {
    save(transactions.filter(x => x.id !== id));
  }

  function handleTokenSave(e: React.FormEvent) {
    e.preventDefault();
    const input = (document.getElementById('gh-token') as HTMLInputElement).value;
    if (input) {
      setGithubToken(input);
      setSynced(true);
      setShowSettings(false);
      notify('success', 'GitHub token tersimpan. Auto-sync aktif.');
      loadFromGithub().then(data => { setTransactions(data); });
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading...</div>;

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

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Settings</h3>
            <form onSubmit={handleTokenSave}>
              <label className="block text-sm text-gray-400 mb-1">GitHub Personal Access Token</label>
              <input id="gh-token" type="password" defaultValue={getGithubToken()} placeholder="ghp_xxxx..."
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg mb-4 focus:outline-none focus:border-teal-500" />
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowSettings(false)} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600">Tutup</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

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
                <h2 className="text-lg font-semibold text-white">Dashboard</h2>
                <p className="text-xs text-gray-400">{transactions.length} total transaksi</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${synced ? 'bg-green-500' : 'bg-yellow-500'}`} title={synced ? 'Synced' : 'Local only'}></span>
              <button onClick={() => setShowSettings(true)} className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700">
                Settings
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard */}
        <main className="px-4 sm:px-6 lg:px-8 py-6">
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
        </main>
      </div>
    </div>
  );
}
