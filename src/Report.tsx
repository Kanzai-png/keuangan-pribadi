import { useMemo, useRef } from 'react';
import type { Transaction, Period, DateRange } from './types';
import { filterByPeriod } from './storage';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

function formatRp(n: number) {
  return 'Rp' + n.toLocaleString('id-ID');
}

interface ReportProps {
  transactions: Transaction[];
  period: Period;
  customRange: DateRange;
  setPeriod: (p: Period) => void;
  setCustomRange: (r: DateRange) => void;
  notify: (type: 'success' | 'error' | 'warning', msg: string) => void;
}

export default function Report({ transactions, period, customRange, setPeriod, setCustomRange, notify }: ReportProps) {
  const barRef = useRef<ChartJS<'bar'>>(null);
  const doughnutRef = useRef<ChartJS<'doughnut'>>(null);

  const filtered = useMemo(() => filterByPeriod(transactions, period, customRange), [transactions, period, customRange]);
  const totalMasuk = filtered.filter(t => t.type === 'masuk').reduce((s, t) => s + t.total, 0);
  const totalKeluar = filtered.filter(t => t.type === 'keluar').reduce((s, t) => s + t.total, 0);
  const saldo = totalMasuk - totalKeluar;

  const periods: { key: Period; label: string }[] = [
    { key: '1w', label: '1 Minggu' },
    { key: '1m', label: '1 Bulan' },
    { key: '3m', label: '3 Bulan' },
    { key: '1y', label: '1 Tahun' },
    { key: 'custom', label: 'Custom' },
    { key: 'all', label: 'Semua' },
  ];

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    filtered.filter(t => t.type === 'keluar').forEach(t => {
      cats[t.category] = (cats[t.category] || 0) + t.total;
    });
    return cats;
  }, [filtered]);

  const monthlyData = useMemo(() => {
    const months: Record<string, { masuk: number; keluar: number }> = {};
    filtered.forEach(t => {
      const m = t.date.slice(0, 7);
      if (!months[m]) months[m] = { masuk: 0, keluar: 0 };
      months[m][t.type] += t.total;
    });
    return months;
  }, [filtered]);

  const expensesDashboard = useMemo(() => {
    const cats: Record<string, { allocation: number; realization: number }> = {};
    filtered.forEach(t => {
      if (!cats[t.category]) cats[t.category] = { allocation: 0, realization: 0 };
      if (t.type === 'keluar') {
        cats[t.category].realization += t.total;
        cats[t.category].allocation += t.total;
      } else {
        cats[t.category].allocation += t.total;
      }
    });
    return cats;
  }, [filtered]);

  function getStatus(usage: number): string {
    if (usage === 0) return 'Safe';
    if (usage < 70) return 'Normal';
    if (usage <= 100) return 'Warning';
    return 'Over Budget';
  }

  const sortedMonths = Object.keys(monthlyData).sort();
  const monthLabels = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const barData = {
    labels: sortedMonths.map(m => { const [, mo] = m.split('-'); return monthLabels[parseInt(mo)-1]; }),
    datasets: [
      { label: 'Masuk', data: sortedMonths.map(m => monthlyData[m].masuk), backgroundColor: '#14b8a6' },
      { label: 'Keluar', data: sortedMonths.map(m => monthlyData[m].keluar), backgroundColor: '#ef4444' },
    ],
  };

  const doughnutLabels = Object.keys(categoryData);
  const colors = ['#14b8a6','#f59e0b','#ef4444','#6366f1','#06b6d4','#ec4899','#8b5cf6','#22c55e','#f97316','#a855f7'];
  const doughnutData = {
    labels: doughnutLabels,
    datasets: [{ data: doughnutLabels.map(l => categoryData[l]), backgroundColor: colors.slice(0, doughnutLabels.length) }],
  };

  async function handleExportXLSX() {
    const wb = new ExcelJS.Workbook();
    const now = new Date();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const currentMonth = monthNames[now.getMonth()];
    const currentYear = now.getFullYear();

    // Colors
    // const DARK_BG = '0D0D14';
    const CARD_BG = '1A1A24';
    const HEADER_BG = '1F2937';
    const TEAL = '14B8A6';
    const RED = 'EF4444';
    const YELLOW = 'F59E0B';
    const GREEN = '22C55E';
    const GRAY_TEXT = '9CA3AF';
    const WHITE = 'FFFFFF';
    const BORDER_COLOR = '374151';

    const ws = wb.addWorksheet('Dashboard', {
      properties: { tabColor: { argb: TEAL } },
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    ws.columns = [
      { width: 20 },
      { width: 18 },
      { width: 18 },
      { width: 16 },
      { width: 4 },
      { width: 18 },
      { width: 20 },
    ];

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: BORDER_COLOR } },
      bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
      left: { style: 'thin', color: { argb: BORDER_COLOR } },
      right: { style: 'thin', color: { argb: BORDER_COLOR } },
    };

    const rpFmt = '#,##0';

    // === HEADER ===
    ws.mergeCells('A1:G1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'Money Management Dashboard';
    titleCell.font = { bold: true, size: 18, color: { argb: WHITE } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 36;

    ws.mergeCells('A2:G2');
    const subtitleCell = ws.getCell('A2');
    subtitleCell.value = `${currentMonth} ${currentYear}`;
    subtitleCell.font = { size: 12, color: { argb: GRAY_TEXT } };
    subtitleCell.alignment = { horizontal: 'center' };

    // === SUMMARY CARDS (F-G, rows 4-7) ===
    const summaryItems: [string, number, string][] = [
      ['Total Income', totalMasuk, TEAL],
      ['Savings', saldo > 0 ? saldo : 0, TEAL],
      ['Total Spending', totalKeluar, RED],
      ['Balance', saldo, saldo >= 0 ? TEAL : RED],
    ];

    for (let i = 0; i < summaryItems.length; i++) {
      const r = 4 + i;
      const labelCell = ws.getCell(`F${r}`);
      labelCell.value = summaryItems[i][0];
      labelCell.font = { bold: true, size: 10, color: { argb: GRAY_TEXT } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CARD_BG } };
      labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
      labelCell.border = thinBorder;

      const valueCell = ws.getCell(`G${r}`);
      valueCell.value = summaryItems[i][1];
      valueCell.font = { bold: true, size: 12, color: { argb: summaryItems[i][2] } };
      valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CARD_BG } };
      valueCell.alignment = { horizontal: 'right', vertical: 'middle' };
      valueCell.border = thinBorder;
      valueCell.numFmt = rpFmt;
    }

    // === EXPENSES TABLE ===
    const tableHeaders = ['Category', 'Allocation', 'Realization', 'Budget Usage %'];
    const headerRowNum = 4;
    ws.getRow(headerRowNum).height = 28;
    for (let c = 0; c < 4; c++) {
      const cell = ws.getCell(headerRowNum, c + 1);
      cell.value = tableHeaders[c];
      cell.font = { bold: true, size: 10, color: { argb: WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
      cell.alignment = { horizontal: c >= 1 ? 'right' : 'left', vertical: 'middle' };
      cell.border = thinBorder;
    }

    let dataRowNum = 5;
    const expenseEntries = Object.entries(expensesDashboard);
    expenseEntries.forEach(([cat, { allocation, realization }]) => {
      const usage = allocation > 0 ? Math.round((realization / allocation) * 10000) / 100 : 0;
      const status = getStatus(usage);

      let statusColor = TEAL;
      if (status === 'Over Budget') statusColor = RED;
      else if (status === 'Warning') statusColor = YELLOW;
      else if (status === 'Safe') statusColor = GREEN;

      const rowRef = ws.getRow(dataRowNum);
      rowRef.height = 24;

      const catCell = ws.getCell(dataRowNum, 1);
      catCell.value = cat;
      catCell.font = { size: 10, color: { argb: WHITE } };
      catCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CARD_BG } };
      catCell.alignment = { vertical: 'middle' };
      catCell.border = thinBorder;

      const allocCell = ws.getCell(dataRowNum, 2);
      allocCell.value = allocation;
      allocCell.font = { size: 10, color: { argb: WHITE } };
      allocCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CARD_BG } };
      allocCell.alignment = { horizontal: 'right', vertical: 'middle' };
      allocCell.border = thinBorder;
      allocCell.numFmt = rpFmt;

      const realCell = ws.getCell(dataRowNum, 3);
      realCell.value = realization;
      realCell.font = { size: 10, color: { argb: usage > 100 ? RED : WHITE } };
      realCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: usage > 100 ? '2A0A0A' : CARD_BG } };
      realCell.alignment = { horizontal: 'right', vertical: 'middle' };
      realCell.border = thinBorder;
      realCell.numFmt = rpFmt;

      const usageCell = ws.getCell(dataRowNum, 4);
      usageCell.value = parseFloat(usage.toFixed(2));
      usageCell.font = { bold: true, size: 10, color: { argb: statusColor } };
      usageCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CARD_BG } };
      usageCell.alignment = { horizontal: 'right', vertical: 'middle' };
      usageCell.border = thinBorder;
      usageCell.numFmt = '0.00"%"';

      dataRowNum++;
    });

    // === CHARTS ===
    const chartStartRow = dataRowNum + 2;

    if (doughnutRef.current) {
      const doughnutCanvas = doughnutRef.current.canvas;
      const doughnutImg = doughnutCanvas.toDataURL('image/png');
      const doughnutBase64 = doughnutImg.split(',')[1];
      const doughnutImageId = wb.addImage({ base64: doughnutBase64, extension: 'png' });
      ws.addImage(doughnutImageId, {
        tl: { col: 0, row: chartStartRow },
        ext: { width: 350, height: 250 },
      });
    }

    if (barRef.current) {
      const barCanvas = barRef.current.canvas;
      const barImg = barCanvas.toDataURL('image/png');
      const barBase64 = barImg.split(',')[1];
      const barImageId = wb.addImage({ base64: barBase64, extension: 'png' });
      ws.addImage(barImageId, {
        tl: { col: 4, row: chartStartRow },
        ext: { width: 450, height: 250 },
      });
    }

    // Sheet 2: Transactions
    const wsTx = wb.addWorksheet('Transactions', {
      properties: { tabColor: { argb: '6366F1' } },
    });
    wsTx.columns = [
      { header: 'Date', width: 12 },
      { header: 'Category', width: 16 },
      { header: 'Description', width: 28 },
      { header: 'Qty', width: 6 },
      { header: 'Price', width: 14 },
      { header: 'Total', width: 14 },
      { header: 'Type', width: 8 },
    ];
    for (let c = 1; c <= 7; c++) {
      const hCell = wsTx.getCell(1, c);
      hCell.font = { bold: true, size: 10, color: { argb: WHITE } };
      hCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
      hCell.border = thinBorder;
    }
    filtered.forEach(t => {
      wsTx.addRow([t.date, t.category, t.description, t.quantity, t.price, t.total, t.type]);
    });

    // Download
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const filename = `money-management-report-${currentYear}-${currentMonth.toLowerCase()}.xlsx`;
    saveAs(blob, filename);
    notify('success', 'XLSX exported: ' + filename);
  }

  return (
    <div className="space-y-6">
      {/* Period Filter + Export */}
      <div className="flex flex-wrap items-center gap-2">
        {periods.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${period === p.key ? 'bg-teal-600 border-teal-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800'}`}>
            {p.label}
          </button>
        ))}
        <button onClick={handleExportXLSX}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium ml-auto">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export XLSX
        </button>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Masuk</p>
          <p className="text-2xl font-bold text-teal-400 mt-2">{formatRp(totalMasuk)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Keluar</p>
          <p className="text-2xl font-bold text-red-400 mt-2">{formatRp(totalKeluar)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Saldo</p>
          <p className="text-2xl font-bold text-white mt-2">{formatRp(saldo)}</p>
        </div>
      </div>

      {/* Expenses Dashboard Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-gray-200">Expenses Dashboard</h3>
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
              {Object.keys(expensesDashboard).length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Belum ada data</td></tr>
              ) : Object.entries(expensesDashboard).map(([cat, { allocation, realization }]) => {
                const usage = allocation > 0 ? Math.round((realization / allocation) * 10000) / 100 : 0;
                const status = getStatus(usage);
                const statusColor = status === 'Safe' ? 'text-teal-400 bg-teal-900/30' : status === 'Normal' ? 'text-green-400 bg-green-900/30' : status === 'Warning' ? 'text-yellow-400 bg-yellow-900/30' : 'text-red-400 bg-red-900/30';
                return (
                  <tr key={cat} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-gray-300 font-medium">{cat}</td>
                    <td className="px-4 py-3 text-gray-300 text-right">{formatRp(allocation)}</td>
                    <td className="px-4 py-3 text-gray-300 text-right">{formatRp(realization)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden hidden sm:block">
                          <div className={`h-full rounded-full ${usage > 100 ? 'bg-red-500' : usage >= 70 ? 'bg-yellow-500' : 'bg-teal-500'}`} style={{ width: Math.min(usage, 100) + '%' }}></div>
                        </div>
                        <span className="text-gray-300">{usage.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>{status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Monthly Expense Trend</h3>
          <div style={{ minHeight: 200, position: "relative" as const }} className="h-[200px] sm:h-[280px]">
            <Bar ref={barRef} data={barData} options={{ responsive: true, maintainAspectRatio: false, animation: { duration: 300 }, plugins: { legend: { labels: { color: '#9ca3af' } } }, scales: { x: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } }, y: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } } } }} />
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Expense Realization %</h3>
          <div style={{ minHeight: 200, position: "relative" as const }} className="h-[200px] sm:h-[280px]">
            {doughnutLabels.length > 0 ? (
              <Doughnut ref={doughnutRef} data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, animation: { duration: 300 }, plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', boxWidth: 12 } } } }} />
            ) : <p className="text-gray-500 text-sm">Belum ada data pengeluaran</p>}
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-gray-200">Transaction Detail ({filtered.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Tanggal</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Kategori</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase hidden sm:table-cell">Deskripsi</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase text-right">Total</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Tipe</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Belum ada transaksi</td></tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-gray-300">{t.date}</td>
                  <td className="px-4 py-3 text-gray-300">{t.category}</td>
                  <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{t.description}</td>
                  <td className={`px-4 py-3 text-right font-medium ${t.type === 'masuk' ? 'text-teal-400' : 'text-red-400'}`}>{formatRp(t.total)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${t.type === 'masuk' ? 'bg-teal-900/50 text-teal-400' : 'bg-red-900/50 text-red-400'}`}>{t.type}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
