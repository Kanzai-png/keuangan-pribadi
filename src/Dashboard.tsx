import { useState, useMemo } from 'react';
import type { Transaction, Period, DateRange, Budget } from './types';
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
  budgets: Budget[];
  onBudgetUpdate: (budgets: Budget[]) => void;
  notify: (type: 'success' | 'error' | 'warning', msg: string) => void;
}

export default function Dashboard({ transactions, period, customRange, setPeriod, setCustomRange, onAdd, onEdit, onDelete, budgets, onBudgetUpdate, notify }: DashboardProps) {
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

  const [priceZeroConfirmed, setPriceZeroConfirmed] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category || !form.description) {
      notify('warning', 'Lengkapi semua field');
      return;
    }
    if (form.price === 0 && !priceZeroConfirmed) {
      notify('warning', 'Harga Rp0 — yakin ini bukan kesalahan input? Klik Tambah lagi untuk konfirmasi.');
      setPriceZeroConfirmed(true);
      return;
    }
    setPriceZeroConfirmed(false);
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

      {/* Budget Tracker */}
      <BudgetSection budgets={budgets} onBudgetUpdate={onBudgetUpdate} filtered={filtered} existingCategories={existingCategories} notify={notify} />

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
                      <div className="flex flex-col items-center gap-3">
                        <svg className="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        {searchQuery ? (
                          <p className="text-sm text-gray-500">Tidak ditemukan untuk "{searchQuery}"</p>
                        ) : (
                          <>
                            <p className="text-base font-medium text-gray-400">Mulai catat keuanganmu</p>
                            <p className="text-sm text-gray-500 max-w-xs">Isi form di atas untuk menambah transaksi pertama. Pilih kategori, masukkan deskripsi dan harga — selesai.</p>
                            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="mt-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-sm font-medium text-white">Tambah Transaksi Pertama</button>
                          </>
                        )}
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

// Budget Section Component
function BudgetSection({ budgets, onBudgetUpdate, filtered, existingCategories, notify }: {
  budgets: Budget[];
  onBudgetUpdate: (b: Budget[]) => void;
  filtered: Transaction[];
  existingCategories: string[];
  notify: (type: 'success' | 'error' | 'warning', msg: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [newAmount, setNewAmount] = useState(0);

  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.filter(t => t.type === 'keluar').forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.total;
    });
    return map;
  }, [filtered]);

  function addBudget() {
    if (!newCat || newAmount <= 0) {
      notify('warning', 'Isi kategori dan jumlah budget');
      return;
    }
    if (budgets.find(b => b.category === newCat)) {
      notify('warning', 'Budget untuk kategori ini sudah ada');
      return;
    }
    onBudgetUpdate([...budgets, { category: newCat, allocation: newAmount }]);
    setNewCat('');
    setNewAmount(0);
    setShowForm(false);
    notify('success', 'Budget ditambahkan');
  }

  function removeBudget(cat: string) {
    onBudgetUpdate(budgets.filter(b => b.category !== cat));
  }

  if (budgets.length === 0 && !showForm) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-300">Budget per Kategori</h3>
            <p className="text-xs text-gray-500 mt-0.5">Set target pengeluaran untuk kontrol keuangan</p>
          </div>
          <button onClick={() => setShowForm(true)} className="px-3 py-1.5 text-xs rounded-lg bg-teal-600 hover:bg-teal-500 font-medium">Set Budget</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">Budget per Kategori</h3>
        <button onClick={() => setShowForm(!showForm)} className="px-2.5 py-1 text-xs rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700">
          {showForm ? 'Batal' : '+ Tambah'}
        </button>
      </div>

      {showForm && (
        <div className="flex flex-wrap gap-2 items-end bg-gray-800/50 rounded-lg p-3">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs text-gray-400 mb-1">Kategori</label>
            <select value={newCat} onChange={e => setNewCat(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-teal-500">
              <option value="">Pilih...</option>
              {existingCategories.filter(c => !budgets.find(b => b.category === c)).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-xs text-gray-400 mb-1">Budget (Rp)</label>
            <input type="number" min="0" value={newAmount} onChange={e => setNewAmount(parseInt(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <button onClick={addBudget} className="px-3 py-1.5 text-xs rounded-lg bg-teal-600 hover:bg-teal-500 font-medium">Simpan</button>
        </div>
      )}

      {budgets.map(b => {
        const spent = spentByCategory[b.category] || 0;
        const pct = Math.min((spent / b.allocation) * 100, 100);
        const over = spent > b.allocation;
        const near = pct >= 80 && !over;
        return (
          <div key={b.category} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium">{b.category}</span>
              <div className="flex items-center gap-2">
                <span className={`${over ? 'text-red-400' : near ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {formatRp(spent)} / {formatRp(b.allocation)}
                </span>
                <button onClick={() => removeBudget(b.category)} className="text-gray-600 hover:text-red-400 text-xs">x</button>
              </div>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${over ? 'bg-red-500' : near ? 'bg-yellow-500' : 'bg-teal-500'}`}
                style={{ width: `${pct}%` }} />
            </div>
            {over && <p className="text-xs text-red-400">Melebihi budget {formatRp(spent - b.allocation)}</p>}
            {near && <p className="text-xs text-yellow-400">Hampir mencapai limit ({pct.toFixed(0)}%)</p>}
          </div>
        );
      })}
    </div>
  );
}