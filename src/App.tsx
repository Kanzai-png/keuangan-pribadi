import { useState, useEffect, useCallback } from 'react';
import type { Transaction, Period, DateRange } from './types';
import {
  loadFromGithub, saveToGithub, saveToLocal,
  filterByPeriod, generateId, getGithubToken, setGithubToken
} from './storage';
import Papa from 'papaparse';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

function formatRp(n: number) {
  return 'Rp' + n.toLocaleString('id-ID');
}

interface Alert {
  id: string;
  type: 'success' | 'error' | 'warning';
  message: string;
}

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [period, setPeriod] = useState<Period>('all');
  const [customRange, setCustomRange] = useState<DateRange>({ start: '', end: '' });
  const [showChart, setShowChart] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [synced, setSynced] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    quantity: 1,
    price: 0,
    type: 'keluar' as 'masuk' | 'keluar',
  });

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

  const filtered = filterByPeriod(transactions, period, customRange);
  const totalMasuk = filtered.filter(t => t.type === 'masuk').reduce((s, t) => s + t.total, 0);
  const totalKeluar = filtered.filter(t => t.type === 'keluar').reduce((s, t) => s + t.total, 0);
  const totalItems = filtered.reduce((s, t) => s + t.quantity, 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category || !form.description || form.price <= 0) {
      notify('warning', 'Lengkapi semua field');
      return;
    }
    const total = form.quantity * form.price;
    if (editId) {
      const updated = transactions.map(t =>
        t.id === editId ? { ...t, ...form, total } : t
      );
      save(updated);
      setEditId(null);
      notify('success', 'Transaksi diupdate');
    } else {
      const newTx: Transaction = { id: generateId(), ...form, total };
      save([newTx, ...transactions]);
      notify('success', 'Transaksi ditambahkan');
    }
    setForm({ date: new Date().toISOString().split('T')[0], category: '', description: '', quantity: 1, price: 0, type: 'keluar' });
  }

  function handleEdit(t: Transaction) {
    setEditId(t.id);
    setForm({ date: t.date, category: t.category, description: t.description, quantity: t.quantity, price: t.price, type: t.type });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function confirmDelete() {
    if (!deleteId) return;
    save(transactions.filter(t => t.id !== deleteId));
    setDeleteId(null);
    notify('success', 'Transaksi dihapus');
  }

  function handleExport() {
    const exportData: Record<string, string | number>[] = filtered.map(t => ({
      Tanggal: t.date, Kategori: t.category, Deskripsi: t.description,
      Qty: t.quantity, 'Harga Satuan': t.price, Total: t.total, Tipe: t.type,
    }));
    exportData.push(
      { Tanggal: '', Kategori: '', Deskripsi: '', Qty: '', 'Harga Satuan': '', Total: '', Tipe: '' },
      { Tanggal: 'RINGKASAN', Kategori: '', Deskripsi: '', Qty: totalItems, 'Harga Satuan': '', Total: '', Tipe: '' },
      { Tanggal: 'Total Masuk', Kategori: '', Deskripsi: '', Qty: '', 'Harga Satuan': '', Total: totalMasuk, Tipe: '' },
      { Tanggal: 'Total Keluar', Kategori: '', Deskripsi: '', Qty: '', 'Harga Satuan': '', Total: totalKeluar, Tipe: '' },
      { Tanggal: 'Saldo', Kategori: '', Deskripsi: '', Qty: '', 'Harga Satuan': '', Total: totalMasuk - totalKeluar, Tipe: '' },
    );
    const csv = Papa.unparse(exportData);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keuangan_${period}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('success', 'CSV berhasil diexport');
  }

  // Chart data
  const barData = (() => {
    const days: Record<string, { masuk: number; keluar: number }> = {};
    filtered.forEach(t => {
      if (!days[t.date]) days[t.date] = { masuk: 0, keluar: 0 };
      days[t.date][t.type] += t.total;
    });
    const labels = Object.keys(days).sort();
    return {
      labels: labels.map(d => d.slice(5)),
      datasets: [
        { label: 'Masuk', data: labels.map(d => days[d].masuk), backgroundColor: '#22c55e' },
        { label: 'Keluar', data: labels.map(d => days[d].keluar), backgroundColor: '#ef4444' },
      ],
    };
  })();

  const doughnutData = (() => {
    const cats: Record<string, number> = {};
    filtered.filter(t => t.type === 'keluar').forEach(t => {
      cats[t.category] = (cats[t.category] || 0) + t.total;
    });
    const labels = Object.keys(cats);
    const colors = ['#6366f1', '#f59e0b', '#ef4444', '#22c55e', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6'];
    return {
      labels,
      datasets: [{ data: labels.map(l => cats[l]), backgroundColor: colors.slice(0, labels.length) }],
    };
  })();

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

  const periods: { key: Period; label: string }[] = [
    { key: '1w', label: '1 Minggu' },
    { key: '1m', label: '1 Bulan' },
    { key: '3m', label: '3 Bulan' },
    { key: '1y', label: '1 Tahun' },
    { key: 'custom', label: 'Custom' },
    { key: 'all', label: 'Semua' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Alerts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {alerts.map(a => (
          <div key={a.id} className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            a.type === 'success' ? 'bg-green-600' : a.type === 'error' ? 'bg-red-600' : 'bg-yellow-600'
          }`}>{a.message}</div>
        ))}
      </div>

      {/* Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full">
            <p className="text-lg mb-4">Hapus transaksi ini?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600">Batal</button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Settings</h3>
            <form onSubmit={handleTokenSave}>
              <label className="block text-sm text-gray-400 mb-1">GitHub Personal Access Token</label>
              <input id="gh-token" type="password" defaultValue={getGithubToken()} placeholder="ghp_xxxx..."
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg mb-4 focus:outline-none focus:border-indigo-500" />
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowSettings(false)} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600">Tutup</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Keuangan Pribadi</h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">{filtered.length} transaksi | {totalItems} item</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className={`w-2 h-2 rounded-full ${synced ? 'bg-green-500' : 'bg-yellow-500'}`} title={synced ? 'Synced' : 'Local only'}></span>
            <button onClick={() => setShowChart(!showChart)} className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700">
              {showChart ? 'Sembunyikan' : 'Chart'}
            </button>
            <button onClick={() => setShowSettings(true)} className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700">
              Settings
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Masuk</p>
            <p className="text-lg sm:text-xl font-semibold text-green-400 mt-1">{formatRp(totalMasuk)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Keluar</p>
            <p className="text-lg sm:text-xl font-semibold text-red-400 mt-1">{formatRp(totalKeluar)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Saldo</p>
            <p className="text-lg sm:text-xl font-semibold text-white mt-1">{formatRp(totalMasuk - totalKeluar)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Item</p>
            <p className="text-lg sm:text-xl font-semibold text-white mt-1">{totalItems}</p>
          </div>
        </div>

        {/* Charts */}
        {showChart && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Masuk vs Keluar</h3>
              <div className="h-48 sm:h-64">
                <Bar data={barData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#9ca3af' } } }, scales: { x: { ticks: { color: '#6b7280' } }, y: { ticks: { color: '#6b7280' } } } }} />
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Pengeluaran per Kategori</h3>
              <div className="h-48 sm:h-64 flex items-center justify-center">
                {doughnutData.labels.length > 0 ? (
                  <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', boxWidth: 12 } } } }} />
                ) : <p className="text-gray-500 text-sm">Belum ada data pengeluaran</p>}
              </div>
            </div>
          </div>
        )}

        {/* Period Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {periods.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-sm rounded-lg border ${period === p.key ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800'}`}>
              {p.label}
            </button>
          ))}
          <button onClick={handleExport} className="ml-auto px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white">
            Export CSV
          </button>
        </div>

        {/* Custom Date Range */}
        {period === 'custom' && (
          <div className="flex flex-wrap gap-3 items-center bg-gray-900 border border-gray-800 rounded-xl p-4">
            <label className="text-sm text-gray-400">Dari:</label>
            <input type="date" value={customRange.start} onChange={e => setCustomRange(r => ({ ...r, start: e.target.value }))}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500" />
            <label className="text-sm text-gray-400">Sampai:</label>
            <input type="date" value={customRange.end} onChange={e => setCustomRange(r => ({ ...r, end: e.target.value }))}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500" />
          </div>
        )}

        {/* Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
          <h2 className="text-base font-semibold mb-4">{editId ? 'Edit Transaksi' : 'Tambah Transaksi'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Tanggal</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Kategori</label>
              <input type="text" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="Makan, Transport..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Deskripsi</label>
              <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Detail transaksi" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Tipe</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'masuk' | 'keluar' }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500">
                <option value="keluar">Keluar</option>
                <option value="masuk">Masuk</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Qty</label>
              <input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Harga Satuan</label>
              <input type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div className="flex items-end">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Total</label>
                <p className="text-lg font-semibold text-indigo-400">{formatRp(form.quantity * form.price)}</p>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium">
                {editId ? 'Update' : 'Tambah'}
              </button>
              {editId && (
                <button type="button" onClick={() => { setEditId(null); setForm({ date: new Date().toISOString().split('T')[0], category: '', description: '', quantity: 1, price: 0, type: 'keluar' }); }}
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm">Batal</button>
              )}
            </div>
          </form>
        </div>

        {/* Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Tanggal</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Kategori</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase hidden sm:table-cell">Deskripsi</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase text-right">Qty</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase text-right hidden md:table-cell">Harga</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase text-right">Total</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Tipe</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Belum ada transaksi</td></tr>
                ) : filtered.map(t => (
                  <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-gray-300">{t.date}</td>
                    <td className="px-4 py-3 text-gray-300">{t.category}</td>
                    <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{t.description}</td>
                    <td className="px-4 py-3 text-gray-300 text-right">{t.quantity}</td>
                    <td className="px-4 py-3 text-gray-300 text-right hidden md:table-cell">{formatRp(t.price)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${t.type === 'masuk' ? 'text-green-400' : 'text-red-400'}`}>{formatRp(t.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${t.type === 'masuk' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>{t.type}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleEdit(t)} className="text-indigo-400 hover:text-indigo-300 text-xs mr-2">Edit</button>
                      <button onClick={() => setDeleteId(t.id)} className="text-red-400 hover:text-red-300 text-xs">Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
