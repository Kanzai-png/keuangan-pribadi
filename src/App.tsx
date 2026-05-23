import { useState, useEffect, useCallback } from 'react';
import type { Transaction, Period } from './types';
import {
  loadFromGithub,
  saveToGithub,
  saveToLocal,
  filterByPeriod,
  generateId,
  getGithubToken,
  setGithubToken,
} from './storage';
import Papa from 'papaparse';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import './index.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [period, setPeriod] = useState<Period>('all');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [token, setToken] = useState(getGithubToken());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    quantity: '1',
    price: '',
    type: 'keluar' as 'masuk' | 'keluar',
  });

  const showAlert = (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 3000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await loadFromGithub();
    setTransactions(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = filterByPeriod(transactions, period);
  const totalMasuk = filtered.filter(t => t.type === 'masuk').reduce((s, t) => s + t.total, 0);
  const totalKeluar = filtered.filter(t => t.type === 'keluar').reduce((s, t) => s + t.total, 0);
  const totalItems = filtered.reduce((s, t) => s + t.quantity, 0);

  // Chart data
  const categoryTotals = filtered.reduce((acc, t) => {
    if (t.type === 'keluar') {
      acc[t.category] = (acc[t.category] || 0) + t.total;
    }
    return acc;
  }, {} as Record<string, number>);

  const dailyData = filtered.reduce((acc, t) => {
    if (!acc[t.date]) acc[t.date] = { masuk: 0, keluar: 0 };
    acc[t.date][t.type] += t.total;
    return acc;
  }, {} as Record<string, { masuk: number; keluar: number }>);

  const sortedDates = Object.keys(dailyData).sort();

  const barChartData = {
    labels: sortedDates,
    datasets: [
      {
        label: 'Masuk',
        data: sortedDates.map(d => dailyData[d].masuk),
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderRadius: 4,
      },
      {
        label: 'Keluar',
        data: sortedDates.map(d => dailyData[d].keluar),
        backgroundColor: 'rgba(239, 68, 68, 0.7)',
        borderRadius: 4,
      },
    ],
  };

  const doughnutData = {
    labels: Object.keys(categoryTotals),
    datasets: [{
      data: Object.values(categoryTotals),
      backgroundColor: [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
        '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
      ],
      borderWidth: 0,
    }],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { labels: { color: '#9ca3af' } },
      title: { display: false },
    },
    scales: {
      x: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } },
      y: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } },
    },
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category || !form.description || !form.price) {
      showAlert('Lengkapi semua field!', 'error');
      return;
    }

    const qty = Number(form.quantity) || 1;
    const price = Number(form.price);
    const total = qty * price;

    if (editId) {
      const updated = transactions.map(t =>
        t.id === editId ? { ...t, date: form.date, category: form.category, description: form.description, quantity: qty, price, total, type: form.type } : t
      );
      setTransactions(updated);
      saveToLocal(updated);
      setSyncing(true);
      await saveToGithub(updated);
      setSyncing(false);
      setEditId(null);
      showAlert('Transaksi berhasil diupdate!');
    } else {
      const tx: Transaction = {
        id: generateId(),
        date: form.date,
        category: form.category,
        description: form.description,
        quantity: qty,
        price,
        total,
        type: form.type,
      };
      const updated = [tx, ...transactions];
      setTransactions(updated);
      saveToLocal(updated);
      setSyncing(true);
      await saveToGithub(updated);
      setSyncing(false);
      showAlert('Transaksi berhasil ditambahkan!');
    }

    setForm(f => ({ ...f, category: '', description: '', quantity: '1', price: '' }));
  }

  function handleEdit(t: Transaction) {
    setEditId(t.id);
    setForm({
      date: t.date,
      category: t.category,
      description: t.description,
      quantity: String(t.quantity),
      price: String(t.price),
      type: t.type,
    });
    showAlert('Mode edit aktif. Ubah data lalu klik Update.', 'warning');
  }

  function handleCancelEdit() {
    setEditId(null);
    setForm({ date: new Date().toISOString().split('T')[0], category: '', description: '', quantity: '1', price: '', type: 'keluar' });
  }

  async function handleDelete(id: string) {
    const updated = transactions.filter(t => t.id !== id);
    setTransactions(updated);
    saveToLocal(updated);
    setConfirmDelete(null);
    setSyncing(true);
    await saveToGithub(updated);
    setSyncing(false);
    showAlert('Transaksi dihapus!');
  }

  function handleExport() {
    const exportData: Record<string, string | number>[] = filtered.map(t => ({
      Tanggal: t.date,
      Kategori: t.category,
      Deskripsi: t.description,
      Qty: t.quantity,
      Harga: t.price,
      Total: t.total,
      Tipe: t.type,
    }));

    // Add summary rows
    exportData.push(
      { Tanggal: '', Kategori: '', Deskripsi: '', Qty: '', Harga: '', Total: '', Tipe: '' },
      { Tanggal: 'RINGKASAN', Kategori: '', Deskripsi: '', Qty: totalItems, Harga: '', Total: '', Tipe: '' },
      { Tanggal: 'Total Masuk', Kategori: '', Deskripsi: '', Qty: '', Harga: '', Total: totalMasuk, Tipe: '' },
      { Tanggal: 'Total Keluar', Kategori: '', Deskripsi: '', Qty: '', Harga: '', Total: totalKeluar, Tipe: '' },
      { Tanggal: 'Saldo', Kategori: '', Deskripsi: '', Qty: '', Harga: '', Total: totalMasuk - totalKeluar, Tipe: '' },
    );

    const csv = Papa.unparse(exportData);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const periodLabel = period === '1w' ? '1minggu' : period === '1m' ? '1bulan' : period === '3m' ? '3bulan' : 'semua';
    link.download = `keuangan_${periodLabel}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showAlert('CSV berhasil di-export!');
  }

  function handleSaveToken() {
    setGithubToken(token);
    setShowSettings(false);
    loadData();
    showAlert('Token tersimpan! Data akan sync ke GitHub.');
  }

  function formatRupiah(n: number) {
    return 'Rp' + n.toLocaleString('id-ID');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 text-sm">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">

        {/* Alert */}
        {alert && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium animate-[slideIn_0.3s_ease] ${
            alert.type === 'success' ? 'bg-emerald-900/90 border border-emerald-700 text-emerald-200' :
            alert.type === 'error' ? 'bg-red-900/90 border border-red-700 text-red-200' :
            'bg-yellow-900/90 border border-yellow-700 text-yellow-200'
          }`}>
            {alert.msg}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
              <h3 className="text-lg font-semibold text-white mb-2">Hapus Transaksi?</h3>
              <p className="text-sm text-gray-400 mb-6">Data yang dihapus tidak bisa dikembalikan.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-medium transition">Batal</button>
                <button onClick={() => handleDelete(confirmDelete)} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-medium transition">Hapus</button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Keuangan Pribadi</h1>
            <p className="text-xs text-gray-500 mt-1">{filtered.length} transaksi | {totalItems} item</p>
          </div>
          <div className="flex items-center gap-2">
            {syncing && (
              <span className="flex items-center gap-1.5 text-xs text-yellow-400">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>syncing
              </span>
            )}
            <button onClick={() => setShowChart(!showChart)} className="text-sm px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition border border-gray-700">
              {showChart ? 'Hide Chart' : 'Chart'}
            </button>
            <button onClick={() => setShowSettings(!showSettings)} className="text-sm px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition border border-gray-700">
              Settings
            </button>
          </div>
        </div>

        {/* Settings */}
        {showSettings && (
          <div className="mb-6 p-5 rounded-2xl bg-gray-900/80 border border-gray-800 backdrop-blur">
            <label className="block text-sm text-gray-400 mb-2 font-medium">GitHub Token</label>
            <div className="flex gap-2">
              <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="ghp_xxxxxxxxxxxx" className="flex-1 px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition" />
              <button onClick={handleSaveToken} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-semibold transition shadow-lg shadow-blue-600/20">Save</button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Data sync ke repo GitHub. Bisa akses dari browser manapun.</p>
          </div>
        )}

        {/* Charts */}
        {showChart && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Pemasukan vs Pengeluaran</h3>
              <Bar data={barChartData} options={chartOptions} />
            </div>
            <div className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Pengeluaran per Kategori</h3>
              {Object.keys(categoryTotals).length > 0 ? (
                <Doughnut data={doughnutData} options={{ responsive: true, plugins: { legend: { labels: { color: '#9ca3af', font: { size: 11 } } } } }} />
              ) : (
                <p className="text-gray-600 text-sm text-center py-8">Belum ada data pengeluaran</p>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mb-6 p-5 rounded-2xl bg-gray-900/80 border border-gray-800 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300">{editId ? 'Edit Transaksi' : 'Tambah Transaksi'}</h2>
            {editId && (
              <button type="button" onClick={handleCancelEdit} className="text-xs px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 transition">Cancel</button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="col-span-2 md:col-span-1 px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition" required />
            <input type="text" placeholder="Kategori" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition" required />
            <input type="text" placeholder="Deskripsi" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition" required />
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'masuk' | 'keluar' }))} className="px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition">
              <option value="keluar">Keluar</option>
              <option value="masuk">Masuk</option>
            </select>
            <input type="number" placeholder="Qty" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition" min="1" required />
            <input type="number" placeholder="Harga satuan" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition" min="0" required />
            <div className="px-4 py-2.5 rounded-xl bg-gray-800/50 border border-gray-700/50 text-sm text-gray-400 flex items-center">
              Total: <span className="ml-1 text-white font-medium">{formatRupiah((Number(form.quantity) || 0) * (Number(form.price) || 0))}</span>
            </div>
            <button type="submit" className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-lg ${editId ? 'bg-yellow-600 hover:bg-yellow-500 shadow-yellow-600/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'}`}>
              {editId ? 'Update' : '+ Tambah'}
            </button>
          </div>
        </form>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex gap-2">
            {(['1w', '1m', '3m', 'all'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${period === p ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'}`}>
                {p === '1w' ? '1 Minggu' : p === '1m' ? '1 Bulan' : p === '3m' ? '3 Bulan' : 'Semua'}
              </button>
            ))}
          </div>
          <button onClick={handleExport} className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-sm font-semibold transition shadow-lg shadow-emerald-700/20 border border-emerald-600/30">
            Export CSV
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/80 to-emerald-900/30 border border-emerald-800/30">
            <p className="text-xs text-gray-400 mb-1">Total Masuk</p>
            <p className="text-lg font-bold text-emerald-400">{formatRupiah(totalMasuk)}</p>
          </div>
          <div className="p-4 rounded-2xl bg-gradient-to-br from-red-950/80 to-red-900/30 border border-red-800/30">
            <p className="text-xs text-gray-400 mb-1">Total Keluar</p>
            <p className="text-lg font-bold text-red-400">{formatRupiah(totalKeluar)}</p>
          </div>
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/80 to-blue-900/30 border border-blue-800/30">
            <p className="text-xs text-gray-400 mb-1">Saldo</p>
            <p className="text-lg font-bold text-blue-400">{formatRupiah(totalMasuk - totalKeluar)}</p>
          </div>
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/80 to-purple-900/30 border border-purple-800/30">
            <p className="text-xs text-gray-400 mb-1">Total Item</p>
            <p className="text-lg font-bold text-purple-400">{totalItems}</p>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl bg-gray-900/80 border border-gray-800 overflow-hidden backdrop-blur">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kategori</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Deskripsi</th>
                  <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="text-right px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Harga</th>
                  <th className="text-right px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipe</th>
                  <th className="px-3 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-600">Belum ada transaksi</td></tr>
                )}
                {filtered.map(t => (
                  <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition group">
                    <td className="px-4 py-3 text-gray-300">{t.date}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-lg bg-gray-800 text-gray-300 text-xs">{t.category}</span></td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{t.description}</td>
                    <td className="px-4 py-3 text-center text-gray-300">{t.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{formatRupiah(t.price)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${t.type === 'masuk' ? 'text-emerald-400' : 'text-red-400'}`}>{formatRupiah(t.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${t.type === 'masuk' ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-800/50' : 'bg-red-900/50 text-red-300 border border-red-800/50'}`}>{t.type}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => handleEdit(t)} className="p-1.5 rounded-lg hover:bg-blue-900/50 text-blue-400 transition" title="Edit">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => setConfirmDelete(t.id)} className="p-1.5 rounded-lg hover:bg-red-900/50 text-red-400 transition" title="Hapus">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-8">Data sync ke GitHub. Buka di browser manapun.</p>
      </div>
    </div>
  );
}

export default App;
