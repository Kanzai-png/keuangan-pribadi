import { useState } from 'react';
import type { Transaction, Period } from './types';
import {
  getTransactions,
  addTransaction,
  deleteTransaction,
  filterByPeriod,
  exportCSV,
  generateId,
} from './storage';
import './App.css';

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>(getTransactions());
  const [period, setPeriod] = useState<Period>('all');
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    amount: '',
    type: 'keluar' as 'masuk' | 'keluar',
  });

  const filtered = filterByPeriod(transactions, period);
  const totalMasuk = filtered.filter(t => t.type === 'masuk').reduce((s, t) => s + t.amount, 0);
  const totalKeluar = filtered.filter(t => t.type === 'keluar').reduce((s, t) => s + t.amount, 0);

  function handleSubmit(e: React.FormEvent) {
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

    const updated = addTransaction(tx);
    setTransactions(updated);
    setForm(f => ({ ...f, category: '', description: '', amount: '' }));
  }

  function handleDelete(id: string) {
    const updated = deleteTransaction(id);
    setTransactions(updated);
  }

  function handleExport() {
    exportCSV(filtered);
  }

  function formatRupiah(n: number) {
    return 'Rp' + n.toLocaleString('id-ID');
  }

  return (
    <div className="app">
      <h1>Keuangan Pribadi</h1>

      <form className="form" onSubmit={handleSubmit}>
        <input
          type="date"
          value={form.date}
          onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          required
        />
        <input
          type="text"
          placeholder="Kategori"
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          required
        />
        <input
          type="text"
          placeholder="Deskripsi"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          required
        />
        <input
          type="number"
          placeholder="Jumlah"
          value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          required
          min="0"
        />
        <select
          value={form.type}
          onChange={e => setForm(f => ({ ...f, type: e.target.value as 'masuk' | 'keluar' }))}
        >
          <option value="keluar">Keluar</option>
          <option value="masuk">Masuk</option>
        </select>
        <button type="submit">Tambah</button>
      </form>

      <div className="controls">
        <div className="periods">
          {(['1w', '1m', '3m', 'all'] as Period[]).map(p => (
            <button
              key={p}
              className={period === p ? 'active' : ''}
              onClick={() => setPeriod(p)}
            >
              {p === '1w' ? '1 Minggu' : p === '1m' ? '1 Bulan' : p === '3m' ? '3 Bulan' : 'Semua'}
            </button>
          ))}
        </div>
        <button className="export-btn" onClick={handleExport}>Export CSV</button>
      </div>

      <div className="summary">
        <span className="masuk">Masuk: {formatRupiah(totalMasuk)}</span>
        <span className="keluar">Keluar: {formatRupiah(totalKeluar)}</span>
        <span className="saldo">Saldo: {formatRupiah(totalMasuk - totalKeluar)}</span>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Kategori</th>
            <th>Deskripsi</th>
            <th>Jumlah</th>
            <th>Tipe</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={6} className="empty">Belum ada transaksi</td></tr>
          )}
          {filtered.map(t => (
            <tr key={t.id} className={t.type}>
              <td>{t.date}</td>
              <td>{t.category}</td>
              <td>{t.description}</td>
              <td>{formatRupiah(t.amount)}</td>
              <td>{t.type}</td>
              <td><button className="del-btn" onClick={() => handleDelete(t.id)}>x</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
