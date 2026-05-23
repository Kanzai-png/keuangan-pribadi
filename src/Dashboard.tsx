import { useState } from 'react';
import type { Transaction, Period, DateRange } from './types';
import { filterByPeriod, generateId } from './storage';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

function formatRp(n: number) {
  return 'Rp' + n.toLocaleString('id-ID');
}

interface DashboardProps {
  transactions: Transaction[];
  period: Period;
  customRange: DateRange;
  setPeriod: (p: Period) => void;
  setCustomRange: (r: DateRange) => void;
  onAdd: (t: Transaction) => void;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
  notify: (type: 'success' | 'error' | 'warning', msg: string) => void;
}

export default function Dashboard({ transactions, period, customRange, setPeriod, setCustomRange, onAdd, onEdit, onDelete, notify }: DashboardProps) {
  const [showChart, setShowChart] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    quantity: 1,
    price: 0,
    type: 'keluar' as 'masuk' | 'keluar',
  });

  const filtered = filterByPeriod(transactions, period, customRange);
  const totalMasuk = filtered.filter(t => t.type === 'masuk').reduce((s, t) => s + t.total, 0);
  const totalKeluar = filtered.filter(t => t.type === 'keluar').reduce((s, t) => s + t.total, 0);
  const totalItems = filtered.reduce((s, t) => s + t.quantity, 0);

  const periods: { key: Period; label: string }[] = [
    { key: '1w', label: '1 Minggu' },
    { key: '1m', label: '1 Bulan' },
    { key: '3m', label: '3 Bulan' },
    { key: '1y', label: '1 Tahun' },
    { key: 'custom', label: 'Custom' },
    { key: 'all', label: 'Semua' },
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category || !form.description || form.price <= 0) {
      notify('warning', 'Lengkapi semua field');
      return;
    }
    const total = form.quantity * form.price;
    if (editId) {
      onEdit({ id: editId, ...form, total });
      setEditId(null);
      notify('success', 'Transaksi diupdate');
    } else {
      onAdd({ id: generateId(), ...form, total });
      notify('success', 'Transaksi ditambahkan');
    }
    setForm({ date: new Date().toISOString().split('T')[0], category: '', description: '', quantity: 1, price: 0, type: 'keluar' });
  }

  function startEdit(t: Transaction) {
    setEditId(t.id);
    setForm({ date: t.date, category: t.category, description: t.description, quantity: t.quantity, price: t.price, type: t.type });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function confirmDelete() {
    if (!deleteId) return;
    onDelete(deleteId);
    setDeleteId(null);
    notify('success', 'Transaksi dihapus');
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
        { label: 'Masuk', data: labels.map(d => days[d].masuk), backgroundColor: '#14b8a6' },
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
    const colors = ['#14b8a6', '#f59e0b', '#ef4444', '#6366f1', '#06b6d4', '#ec4899', '#8b5cf6', '#22c55e'];
    return {
      labels,
      datasets: [{ data: labels.map(l => cats[l]), backgroundColor: colors.slice(0, labels.length) }],
    };
  })();

  return (
    <div className="space-y-6">
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Masuk</p>
          <p className="text-lg sm:text-xl font-semibold text-teal-400 mt-1">{formatRp(totalMasuk)}</p>
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

      {/* Chart Toggle + Period */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setShowChart(!showChart)}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${showChart ? 'bg-teal-600 border-teal-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800'}`}>
          {showChart ? 'Sembunyikan Chart' : 'Tampilkan Chart'}
        </button>
        <div className="w-px h-6 bg-gray-700 mx-1 hidden sm:block"></div>
        {periods.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${period === p.key ? 'bg-teal-600 border-teal-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="flex flex-wrap gap-3 items-center bg-gray-900 border border-gray-800 rounded-xl p-4">
          <label className="text-sm text-gray-400">Dari:</label>
          <input type="date" value={customRange.start} onChange={e => setCustomRange({ ...customRange, start: e.target.value })}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
          <label className="text-sm text-gray-400">Sampai:</label>
          <input type="date" value={customRange.end} onChange={e => setCustomRange({ ...customRange, end: e.target.value })}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
        </div>
      )}

      {/* Charts */}
      {showChart && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Masuk vs Keluar</h3>
            <div className="h-48 sm:h-64">
              <Bar data={barData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#9ca3af' } } }, scales: { x: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } }, y: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } } } }} />
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

      {/* Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
        <h2 className="text-base font-semibold mb-4">{editId ? 'Edit Transaksi' : 'Tambah Transaksi'}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Tanggal</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Kategori</label>
            <input type="text" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              placeholder="Makan, Transport..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Deskripsi</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Detail transaksi" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Tipe</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'masuk' | 'keluar' }))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-teal-500">
              <option value="keluar">Keluar</option>
              <option value="masuk">Masuk</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Qty</label>
            <input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Harga Satuan</label>
            <input type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div className="flex items-end">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Total</label>
              <p className="text-lg font-semibold text-teal-400">{formatRp(form.quantity * form.price)}</p>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-sm font-medium">
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
                  <td className={`px-4 py-3 text-right font-medium ${t.type === 'masuk' ? 'text-teal-400' : 'text-red-400'}`}>{formatRp(t.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${t.type === 'masuk' ? 'bg-teal-900/50 text-teal-400' : 'bg-red-900/50 text-red-400'}`}>{t.type}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => startEdit(t)} className="text-teal-400 hover:text-teal-300 text-xs mr-2">Edit</button>
                    <button onClick={() => setDeleteId(t.id)} className="text-red-400 hover:text-red-300 text-xs">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
