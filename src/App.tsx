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
import './index.css';

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [period, setPeriod] = useState<Period>('all');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [token, setToken] = useState(getGithubToken());
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    amount: '',
    type: 'keluar' as 'masuk' | 'keluar',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await loadFromGithub();
    setTransactions(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = filterByPeriod(transactions, period);
  const totalMasuk = filtered.filter(t => t.type === 'masuk').reduce((s, t) => s + t.amount, 0);
  const totalKeluar = filtered.filter(t => t.type === 'keluar').reduce((s, t) => s + t.amount, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category || !form.description || !form.amount) return;

    const tx: Transaction = {
      id: generateId(),
      date: form.date,
      category: form.category,
      description: form.description,
      amount: Number(form.amount),
      type: form.type,
    };

    const updated = [tx, ...transactions];
    setTransactions(updated);
    saveToLocal(updated);
    setForm(f => ({ ...f, category: '', description: '', amount: '' }));

    // Sync to GitHub in background
    setSyncing(true);
    await saveToGithub(updated);
    setSyncing(false);
  }

  async function handleDelete(id: string) {
    const updated = transactions.filter(t => t.id !== id);
    setTransactions(updated);
    saveToLocal(updated);
    setSyncing(true);
    await saveToGithub(updated);
    setSyncing(false);
  }

  function handleExport() {
    const exportData = filtered.map(t => ({
      Tanggal: t.date,
      Kategori: t.category,
      Deskripsi: t.description,
      Jumlah: t.amount,
      Tipe: t.type,
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const periodLabel = period === '1w' ? '1minggu' : period === '1m' ? '1bulan' : period === '3m' ? '3bulan' : 'semua';
    link.download = `keuangan_${periodLabel}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleSaveToken() {
    setGithubToken(token);
    setShowSettings(false);
    loadData();
  }

  function formatRupiah(n: number) {
    return 'Rp' + n.toLocaleString('id-ID');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Keuangan Pribadi</h1>
          <div className="flex items-center gap-2">
            {syncing && <span className="text-xs text-yellow-400">syncing...</span>}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-sm px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
            >
              Settings
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-6 p-4 rounded-xl bg-gray-900 border border-gray-800">
            <label className="block text-sm text-gray-400 mb-2">GitHub Token (untuk sync data)</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleSaveToken}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition"
              >
                Save
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Token disimpan di browser. Data sync ke GitHub repo.</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mb-6 p-4 rounded-xl bg-gray-900 border border-gray-800">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="col-span-2 md:col-span-1 px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Kategori"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Deskripsi"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              required
            />
            <input
              type="number"
              placeholder="Jumlah"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              required
              min="0"
            />
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as 'masuk' | 'keluar' }))}
              className="px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="keluar">Keluar</option>
              <option value="masuk">Masuk</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold transition"
            >
              + Tambah
            </button>
          </div>
        </form>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex gap-2">
            {(['1w', '1m', '3m', 'all'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {p === '1w' ? '1 Minggu' : p === '1m' ? '1 Bulan' : p === '3m' ? '3 Bulan' : 'Semua'}
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-sm font-medium transition"
          >
            Export CSV
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-800/30 text-center">
            <p className="text-xs text-gray-400 mb-1">Masuk</p>
            <p className="text-sm font-semibold text-emerald-400">{formatRupiah(totalMasuk)}</p>
          </div>
          <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/30 text-center">
            <p className="text-xs text-gray-400 mb-1">Keluar</p>
            <p className="text-sm font-semibold text-red-400">{formatRupiah(totalKeluar)}</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-950/50 border border-blue-800/30 text-center">
            <p className="text-xs text-gray-400 mb-1">Saldo</p>
            <p className="text-sm font-semibold text-blue-400">{formatRupiah(totalMasuk - totalKeluar)}</p>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Kategori</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Deskripsi</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tipe</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-600">Belum ada transaksi</td>
                </tr>
              )}
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                  <td className="px-4 py-3 text-gray-300">{t.date}</td>
                  <td className="px-4 py-3 text-gray-300">{t.category}</td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{t.description}</td>
                  <td className={`px-4 py-3 text-right font-medium ${t.type === 'masuk' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatRupiah(t.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      t.type === 'masuk' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'
                    }`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-gray-600 hover:text-red-400 transition text-lg"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">Data sync ke GitHub. Buka di browser manapun.</p>
      </div>
    </div>
  );
}

export default App;
