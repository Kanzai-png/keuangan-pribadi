import { useMemo } from 'react';
import type { Transaction, Period, DateRange } from './types';
import { filterByPeriod } from './storage';
import Papa from 'papaparse';

interface ReportProps {
  transactions: Transaction[];
  period: Period;
  customRange: DateRange;
  setPeriod: (p: Period) => void;
  setCustomRange: (r: DateRange) => void;
  notify: (type: 'success' | 'error' | 'warning', msg: string) => void;
}

export default function Report({ transactions, period, customRange, setPeriod, setCustomRange, notify }: ReportProps) {
  const filtered = filterByPeriod(transactions, period, customRange);

  const periods: { key: Period; label: string }[] = [
    { key: '1w', label: '1 Minggu' },
    { key: '1m', label: '1 Bulan' },
    { key: '3m', label: '3 Bulan' },
    { key: '1y', label: '1 Tahun' },
    { key: 'custom', label: 'Custom' },
    { key: 'all', label: 'Semua' },
  ];

  // Budget allocation per category (user can customize later)
  const budgets = useMemo(() => {
    const cats: Record<string, number> = {};
    filtered.forEach(t => {
      if (t.type === 'keluar') {
        cats[t.category] = (cats[t.category] || 0) + t.total;
      }
    });
    return cats;
  }, [filtered]);

  // Get allocations from localStorage or default
  const allocations = useMemo(() => {
    const stored = localStorage.getItem('keuangan_budgets');
    if (stored) return JSON.parse(stored) as Record<string, number>;
    // Default allocations
    const defaults: Record<string, number> = {};
    Object.keys(budgets).forEach(cat => {
      defaults[cat] = Math.ceil(budgets[cat] * 1.3); // 130% of actual as default
    });
    return defaults;
  }, [budgets]);



  function getStatus(usage: number): string {
    if (usage === 0) return 'Safe';
    if (usage < 70) return 'Normal';
    if (usage <= 100) return 'Warning';
    return 'Over Budget';
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'Safe': return 'text-teal-400 bg-teal-900/30';
      case 'Normal': return 'text-green-400 bg-green-900/30';
      case 'Warning': return 'text-yellow-400 bg-yellow-900/30';
      case 'Over Budget': return 'text-red-400 bg-red-900/30';
      default: return 'text-gray-400';
    }
  }

  const reportData = useMemo(() => {
    const categories = Object.keys(budgets);
    return categories.map(cat => {
      const allocation = allocations[cat] || 0;
      const realization = budgets[cat] || 0;
      const usagePercent = allocation > 0 ? parseFloat(((realization / allocation) * 100).toFixed(2)) : 0;
      const status = getStatus(usagePercent);
      return { category: cat, allocation, realization, usagePercent, status };
    });
  }, [budgets, allocations]);

  function handleExportBudgetCSV() {
    const now = new Date();
    const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const filename = `money-management-report-${now.getFullYear()}-${monthNames[now.getMonth()]}.csv`;

    const csvData = reportData.map(r => ({
      Category: r.category,
      Allocation: r.allocation,
      Realization: r.realization,
      UsagePercent: r.usagePercent,
      Status: r.status,
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    notify('success', `Exported: ${filename}`);
  }

  function handleExportTransactionCSV() {
    const totalMasuk = filtered.filter(t => t.type === 'masuk').reduce((s, t) => s + t.total, 0);
    const totalKeluar = filtered.filter(t => t.type === 'keluar').reduce((s, t) => s + t.total, 0);
    const totalItems = filtered.reduce((s, t) => s + t.quantity, 0);

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
    notify('success', 'CSV transaksi berhasil diexport');
  }

  function formatRp(n: number) {
    return 'Rp' + n.toLocaleString('id-ID');
  }

  return (
    <div className="space-y-6">
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

      {/* Budget Report Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-800">
          <h3 className="text-base font-semibold text-white">Expenses Dashboard</h3>
          <button onClick={handleExportBudgetCSV}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Category</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase text-right">Allocation</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase text-right">Realization</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase text-right">Usage %</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {reportData.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Belum ada data pengeluaran</td></tr>
              ) : reportData.map(r => (
                <tr key={r.category} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-gray-200 font-medium">{r.category}</td>
                  <td className="px-4 py-3 text-gray-300 text-right">{formatRp(r.allocation)}</td>
                  <td className="px-4 py-3 text-gray-300 text-right">{formatRp(r.realization)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-200">{r.usagePercent}%</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(r.status)}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Export */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Export Transaksi</h3>
          <button onClick={handleExportTransactionCSV}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export CSV
          </button>
        </div>
        <p className="text-sm text-gray-400">Export semua transaksi periode <span className="text-teal-400 font-medium">{period === 'all' ? 'semua waktu' : period}</span> ke file CSV dengan ringkasan otomatis.</p>
        <p className="text-xs text-gray-500 mt-2">{filtered.length} transaksi akan diexport</p>
      </div>
    </div>
  );
}
