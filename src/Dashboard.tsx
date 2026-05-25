import { useState, useMemo } from 'react';
import type { Transaction, Period, DateRange } from './types';
import { filterByPeriod, generateId } from './storage';

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
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
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
  const saldo = totalMasuk - totalKeluar;
  const totalItems = filtered.reduce((s, t) => s + t.quantity, 0);

  // Extract unique categories for autocomplete
  const existingCategories = useMemo(() => {
    const cats = new Set(transactions.map(t => t.category));
    return Array.from(cats).filter(Boolean).sort();
  }, [transactions]);
  const [showCatSuggestions, setShowCatSuggestions] = useState(false);
  const filteredCats = existingCategories.filter(c => c.toLowerCase().includes(form.category.toLowerCase()) && c !== form.category);

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
          <p className="text-lg sm:text-xl font-semibold text-white mt-1">{formatRp(saldo)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Item</p>
          <p className="text-lg sm:text-xl font-semibold text-white mt-1">{totalItems}</p>
        </div>
      </div>

      {/* Period Filter */}
      <div className="flex flex-wrap items-center gap-2">
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

      {/* Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
        <h2 className="text-base font-semibold mb-4">{editId ? 'Edit Transaksi' : 'Tambah Transaksi'}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Tanggal</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div className="relative">
            <label className="block text-xs text-gray-400 mb-1">Kategori</label>
            <input type="text" value={form.category} onChange={e => { setForm(f => ({ ...f, category: e.target.value })); setShowCatSuggestions(true); }}
              onFocus={() => setShowCatSuggestions(true)} onBlur={() => setTimeout(() => setShowCatSuggestions(false), 150)}
              placeholder="Makan, Transport..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
            {showCatSuggestions && filteredCats.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-32 overflow-y-auto">
                {filteredCats.map(cat => (
                  <button key={cat} type="button" onMouseDown={() => { setForm(f => ({ ...f, category: cat })); setShowCatSuggestions(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors">
                    {cat}
                  </button>
                ))}
              </div>
            )}
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

      {/* Transaction Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-200">Riwayat Transaksi ({filtered.length})</h3>
          <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Cari kategori/deskripsi..." className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-teal-500 w-full sm:w-56" />
        </div>
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
              {(() => {
                const searched = filtered.filter(t =>
                  t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  t.description.toLowerCase().includes(searchQuery.toLowerCase())
                );
                const totalPages = Math.ceil(searched.length / PAGE_SIZE);
                const paginated = searched.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

                if (searched.length === 0) {
                  return (
                    <tr><td colSpan={8} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-10 h-10 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        <p className="text-sm text-gray-500">{searchQuery ? 'Tidak ditemukan' : 'Belum ada transaksi'}</p>
                        {!searchQuery && <p className="text-xs text-gray-600">Tambah transaksi pertama kamu di form atas</p>}
                      </div>
                    </td></tr>
                  );
                }

                return (
                  <>
                    {paginated.map(t => (
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
                    {totalPages > 1 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">{searched.length} transaksi, halaman {currentPage}/{totalPages}</span>
                            <div className="flex gap-1">
                              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                className="px-2.5 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
                              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                className="px-2.5 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
