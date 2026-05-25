import { useMemo } from 'react';
import type { Transaction, Period, DateRange } from './types';
import { filterByPeriod } from './storage';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  Legend as RLegend, ResponsiveContainer, PieChart, Pie as RPie, Cell
} from 'recharts';

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

  // Recharts data format
  const barChartData = sortedMonths.map(m => {
    const [, mo] = m.split('-');
    return {
      name: monthLabels[parseInt(mo) - 1],
      masuk: monthlyData[m].masuk,
      keluar: monthlyData[m].keluar,
    };
  });

  const pieChartData = Object.entries(categoryData).map(([name, value]) => ({ name, value }));
  const COLORS = ['#14b8a6','#f59e0b','#ef4444','#6366f1','#06b6d4','#ec4899','#8b5cf6','#22c55e','#f97316','#a855f7'];

  async function handleExportXLSX() {
    const wb = new ExcelJS.Workbook();
    const now = new Date();
    const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const currentMonth = monthNames[now.getMonth()];
    const currentYear = now.getFullYear();

    // Colors
    const TEAL_DARK = '1A7A7A';
    const TEAL = '2E9E9E';
    const WHITE = 'FFFFFF';
    const BLACK = '000000';
    const BLUE = '0000FF';
    const RED_TEXT = 'FF0000';
    const GRAY = '555555';
    const LIGHT_GRAY = 'AAAAAA';
    const ALT_ROW = 'F9F9F9';
    const TOTAL_ROW = 'E0F5F5';

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: BLACK } },
      bottom: { style: 'thin', color: { argb: BLACK } },
      left: { style: 'thin', color: { argb: BLACK } },
      right: { style: 'thin', color: { argb: BLACK } },
    };
    const rpFmt = '#,##0';
    const pctFmt = '0.00%';

    // ========== SHEET 1: REPORT ==========
    const ws = wb.addWorksheet('Report', { properties: { tabColor: { argb: '14B8A6' } } });
    ws.columns = [
      { width: 22 }, { width: 18 }, { width: 18 }, { width: 35 },
      { width: 12 }, { width: 4 }, { width: 18 }, { width: 16 },
    ];

    // Row 1: Title
    ws.mergeCells('A1:C1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'Dasbor Manajemen Keuangan';
    titleCell.font = { bold: true, size: 16, color: { argb: TEAL_DARK } };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(1).height = 30;

    const dateCell = ws.getCell('D1');
    dateCell.value = `Tahun: ${currentYear}     Bulan: ${currentMonth}`;
    dateCell.font = { size: 10, color: { argb: GRAY } };
    dateCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // Row 2: Section header
    ws.mergeCells('A2:E2');
    const sectionCell = ws.getCell('A2');
    sectionCell.value = 'Laporan Bulanan';
    sectionCell.font = { bold: true, size: 11, color: { argb: WHITE } };
    sectionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_DARK } };
    sectionCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 21.75;

    // Row 3: Summary headers
    ['Total Pemasukan', `Tabungan ${currentMonth}`, `Pengeluaran ${currentMonth}`, 'Saldo Bank 1'].forEach((h, i) => {
      const cell = ws.getCell(3, i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 9, color: { argb: WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });
    ws.getRow(3).height = 18;

    // Row 4: Summary values
    [
      { val: totalMasuk, color: BLUE },
      { val: saldo > 0 ? saldo : 0, color: BLUE },
      { val: totalKeluar, color: BLACK },
      { val: saldo, color: BLACK },
    ].forEach((s, i) => {
      const cell = ws.getCell(4, i + 1);
      cell.value = s.val;
      cell.font = { bold: true, size: 13, color: { argb: s.color } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WHITE } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
      cell.numFmt = rpFmt;
    });
    ws.getRow(4).height = 24;

    // Row 5: Spacer
    ws.getRow(5).height = 6;

    // Row 6: Expenses header
    ['Daftar Pengeluaran', 'Alokasi', 'Realisasi', 'Progress Penggunaan Budget', '% Penggunaan'].forEach((h, i) => {
      const cell = ws.getCell(6, i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 9, color: { argb: WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });
    ws.getRow(6).height = 18;

    // Rows 7+: Expense data
    let dataRow = 7;
    const expenseEntries = Object.entries(expensesDashboard);
    expenseEntries.forEach(([cat, { allocation, realization }], idx) => {
      const isAlt = idx % 2 === 1;
      const bgColor = isAlt ? ALT_ROW : WHITE;
      const usage = allocation > 0 ? realization / allocation : 0;
      const isOver = usage > 1;
      const usageFontColor = isOver ? RED_TEXT : BLACK;

      ws.getRow(dataRow).height = 15.75;

      const catCell = ws.getCell(dataRow, 1);
      catCell.value = cat;
      catCell.font = { size: 9 };
      catCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      catCell.alignment = { vertical: 'middle' };
      catCell.border = thinBorder;

      const allocCell = ws.getCell(dataRow, 2);
      allocCell.value = allocation;
      allocCell.font = { size: 9, color: { argb: BLUE } };
      allocCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      allocCell.alignment = { horizontal: 'right', vertical: 'middle' };
      allocCell.border = thinBorder;
      allocCell.numFmt = rpFmt;

      const realCell = ws.getCell(dataRow, 3);
      realCell.value = realization;
      realCell.font = { size: 9, color: { argb: BLUE } };
      realCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      realCell.alignment = { horizontal: 'right', vertical: 'middle' };
      realCell.border = thinBorder;
      realCell.numFmt = rpFmt;

      const progCell = ws.getCell(dataRow, 4);
      progCell.value = { formula: `IFERROR(C${dataRow}/B${dataRow},0)` };
      progCell.font = { size: 9, color: { argb: LIGHT_GRAY } };
      progCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      progCell.alignment = { horizontal: 'left', vertical: 'middle' };
      progCell.border = thinBorder;
      progCell.numFmt = pctFmt;

      const usageCell = ws.getCell(dataRow, 5);
      usageCell.value = { formula: `IFERROR(C${dataRow}/B${dataRow},0)` };
      usageCell.font = { size: 9, color: { argb: usageFontColor } };
      usageCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      usageCell.alignment = { horizontal: 'right', vertical: 'middle' };
      usageCell.border = thinBorder;
      usageCell.numFmt = pctFmt;

      dataRow++;
    });

    // TOTAL row
    ws.getRow(dataRow).height = 18;
    ['TOTAL', { formula: `SUM(B7:B${dataRow-1})` }, { formula: `SUM(C7:C${dataRow-1})` }, '', { formula: `IFERROR(C${dataRow}/B${dataRow},0)` }].forEach((val, i) => {
      const cell = ws.getCell(dataRow, i + 1);
      cell.value = val;
      cell.font = { bold: true, size: 9 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_ROW } };
      cell.alignment = { horizontal: i >= 1 ? 'right' : 'left', vertical: 'bottom' };
      cell.border = thinBorder;
      if (i >= 1 && i <= 2) cell.numFmt = rpFmt;
      if (i === 4) cell.numFmt = pctFmt;
    });

    // Reference table (G:H)
    ws.getCell('G1').value = 'Keterangan';
    ws.getCell('G1').font = { size: 11 };
    ws.getCell('H1').value = 'Jumlah';
    ws.getCell('H1').font = { size: 11 };

    const refItems = [
      ['Total Pemasukan', totalMasuk],
      ['Total Pengeluaran', totalKeluar],
      ['Tabungan', saldo > 0 ? saldo : 0],
      ['Saldo', saldo],
    ];
    refItems.forEach(([label, val], i) => {
      const row = i + 2;
      ws.getCell(`G${row}`).value = label;
      ws.getCell(`G${row}`).font = { size: 11, color: { argb: BLACK } };
      ws.getCell(`H${row}`).value = val;
      ws.getCell(`H${row}`).font = { size: 11, color: { argb: BLACK } };
      ws.getCell(`H${row}`).numFmt = rpFmt;
    });

    // Chart images skipped (Recharts is SVG-based, no canvas export)

    // ========== SHEET 2: BUDGETING ==========
    const wsBudget = wb.addWorksheet('Budgeting', { properties: { tabColor: { argb: '6366F1' } } });
    wsBudget.columns = [{ width: 25 }, { width: 20 }, { width: 18 }, { width: 18 }];

    wsBudget.mergeCells('A1:D1');
    wsBudget.getCell('A1').value = 'Lembar Anggaran';
    wsBudget.getCell('A1').font = { bold: true, size: 13, color: { argb: WHITE } };
    wsBudget.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_DARK } };
    wsBudget.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    wsBudget.getRow(1).height = 24;

    ['Kategori', 'Anggaran Bulanan', 'Terpakai', 'Sisa'].forEach((h, i) => {
      const cell = wsBudget.getCell(2, i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 9, color: { argb: WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
      cell.alignment = { horizontal: 'center', vertical: 'bottom' };
      cell.border = thinBorder;
    });

    expenseEntries.forEach(([cat, { allocation, realization }], idx) => {
      const row = idx + 3;
      wsBudget.getCell(row, 1).value = cat;
      wsBudget.getCell(row, 1).font = { size: 11 };
      wsBudget.getCell(row, 1).border = thinBorder;

      wsBudget.getCell(row, 2).value = allocation;
      wsBudget.getCell(row, 2).font = { size: 11, color: { argb: BLUE } };
      wsBudget.getCell(row, 2).border = thinBorder;
      wsBudget.getCell(row, 2).numFmt = rpFmt;

      wsBudget.getCell(row, 3).value = realization;
      wsBudget.getCell(row, 3).font = { size: 11, color: { argb: BLUE } };
      wsBudget.getCell(row, 3).border = thinBorder;
      wsBudget.getCell(row, 3).numFmt = rpFmt;

      wsBudget.getCell(row, 4).value = { formula: `B${row}-C${row}` };
      wsBudget.getCell(row, 4).font = { size: 11 };
      wsBudget.getCell(row, 4).border = thinBorder;
      wsBudget.getCell(row, 4).numFmt = rpFmt;
    });

    // ========== SHEET 3: SUMMARY ==========
    const wsSummary = wb.addWorksheet('Summary', { properties: { tabColor: { argb: 'F59E0B' } } });
    wsSummary.columns = [{ width: 30 }, { width: 20 }];

    wsSummary.mergeCells('A1:B1');
    wsSummary.getCell('A1').value = 'Ringkasan Bulanan';
    wsSummary.getCell('A1').font = { bold: true, size: 13, color: { argb: WHITE } };
    wsSummary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_DARK } };
    wsSummary.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    wsSummary.getRow(1).height = 24;

    [
      ['Total Pemasukan', totalMasuk],
      ['Total Tabungan', saldo > 0 ? saldo : 0],
      ['Total Pengeluaran', totalKeluar],
      ['Saldo', saldo],
    ].forEach(([label, val], i) => {
      const row = i + 3;
      wsSummary.getCell(row, 1).value = label;
      wsSummary.getCell(row, 1).font = { size: 10 };
      wsSummary.getCell(row, 1).border = thinBorder;
      wsSummary.getCell(row, 2).value = val;
      wsSummary.getCell(row, 2).font = { bold: true, size: 10 };
      wsSummary.getCell(row, 2).alignment = { horizontal: 'right' };
      wsSummary.getCell(row, 2).border = thinBorder;
      wsSummary.getCell(row, 2).numFmt = rpFmt;
    });

    wsSummary.getCell(7, 1).value = 'Tingkat Tabungan';
    wsSummary.getCell(7, 1).font = { size: 10 };
    wsSummary.getCell(7, 1).border = thinBorder;
    wsSummary.getCell(7, 2).value = totalMasuk > 0 ? saldo / totalMasuk : 0;
    wsSummary.getCell(7, 2).font = { size: 10 };
    wsSummary.getCell(7, 2).alignment = { horizontal: 'right' };
    wsSummary.getCell(7, 2).border = thinBorder;
    wsSummary.getCell(7, 2).numFmt = '0.0%';

    wsSummary.getCell(8, 1).value = 'Tingkat Pengeluaran';
    wsSummary.getCell(8, 1).font = { size: 10 };
    wsSummary.getCell(8, 1).border = thinBorder;
    wsSummary.getCell(8, 2).value = totalMasuk > 0 ? totalKeluar / totalMasuk : 0;
    wsSummary.getCell(8, 2).font = { size: 10 };
    wsSummary.getCell(8, 2).alignment = { horizontal: 'right' };
    wsSummary.getCell(8, 2).border = thinBorder;
    wsSummary.getCell(8, 2).numFmt = '0.0%';

    // ========== SHEET 4: SPENDING ==========
    const wsTx = wb.addWorksheet('Spending', { properties: { tabColor: { argb: 'EF4444' } } });
    wsTx.columns = [{ width: 14 }, { width: 18 }, { width: 28 }, { width: 16 }];

    wsTx.mergeCells('A1:D1');
    wsTx.getCell('A1').value = 'Log Pengeluaran Harian';
    wsTx.getCell('A1').font = { bold: true, size: 13, color: { argb: WHITE } };
    wsTx.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_DARK } };
    wsTx.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    wsTx.getRow(1).height = 24;

    ['Tanggal', 'Kategori', 'Keterangan', 'Jumlah'].forEach((h, i) => {
      const cell = wsTx.getCell(2, i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 9, color: { argb: WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
      cell.alignment = { horizontal: 'center', vertical: 'bottom' };
      cell.border = thinBorder;
    });

    const keluarOnly = filtered.filter(t => t.type === 'keluar').sort((a, b) => a.date.localeCompare(b.date));
    keluarOnly.forEach((t, idx) => {
      const row = idx + 3;
      wsTx.getCell(row, 1).value = t.date;
      wsTx.getCell(row, 1).font = { size: 9 };
      wsTx.getCell(row, 1).border = thinBorder;
      wsTx.getCell(row, 1).numFmt = 'yyyy-mm-dd';

      wsTx.getCell(row, 2).value = t.category;
      wsTx.getCell(row, 2).font = { size: 9 };
      wsTx.getCell(row, 2).border = thinBorder;

      wsTx.getCell(row, 3).value = t.description;
      wsTx.getCell(row, 3).font = { size: 9 };
      wsTx.getCell(row, 3).border = thinBorder;

      wsTx.getCell(row, 4).value = t.total;
      wsTx.getCell(row, 4).font = { size: 9 };
      wsTx.getCell(row, 4).alignment = { horizontal: 'right' };
      wsTx.getCell(row, 4).border = thinBorder;
      wsTx.getCell(row, 4).numFmt = rpFmt;
    });

    const txTotalRow = keluarOnly.length + 3;
    wsTx.getCell(txTotalRow, 3).value = 'TOTAL';
    wsTx.getCell(txTotalRow, 3).font = { bold: true, size: 9 };
    wsTx.getCell(txTotalRow, 4).value = { formula: `SUM(D3:D${txTotalRow - 1})` };
    wsTx.getCell(txTotalRow, 4).font = { bold: true, size: 9 };
    wsTx.getCell(txTotalRow, 4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_ROW } };
    wsTx.getCell(txTotalRow, 4).alignment = { horizontal: 'right' };
    wsTx.getCell(txTotalRow, 4).numFmt = rpFmt;

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
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Monthly Expense Trend</h3>
          <div className="h-[240px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} barCategoryGap="20%" barGap={4}>
                <defs>
                  <linearGradient id="gradMasuk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="gradKeluar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#dc2626" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(55,65,81,0.4)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000000 ? (v/1000000).toFixed(0)+'jt' : v >= 1000 ? (v/1000).toFixed(0)+'rb' : String(v)} />
                <RTooltip
                  contentStyle={{ backgroundColor: 'rgba(17,24,39,0.95)', border: '1px solid rgba(55,65,81,0.6)', borderRadius: 12, backdropFilter: 'blur(8px)', padding: '12px 16px' }}
                  labelStyle={{ color: '#e5e7eb', fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: '#d1d5db', fontSize: 12 }}
                  formatter={(value: any) => [formatRp(Number(value)), '']}
                  cursor={{ fill: 'rgba(55,65,81,0.2)' }}
                />
                <RLegend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 12 }} formatter={(value: string) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{value === 'masuk' ? 'Masuk' : 'Keluar'}</span>} />
                <Bar dataKey="masuk" fill="url(#gradMasuk)" radius={[6, 6, 0, 0]} maxBarSize={32} />
                <Bar dataKey="keluar" fill="url(#gradKeluar)" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Expense by Category</h3>
          <div className="h-[240px] sm:h-[300px]">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <RPie
                    data={pieChartData}
                    cx="50%"
                    cy="45%"
                    innerRadius="45%"
                    outerRadius="75%"
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                    label={(({ name, percent }: any) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`) as any}
                    labelLine={{ stroke: '#6b7280', strokeWidth: 1 }}
                  >
                    {pieChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </RPie>
                  <RTooltip
                    contentStyle={{ backgroundColor: 'rgba(17,24,39,0.95)', border: '1px solid rgba(55,65,81,0.6)', borderRadius: 12, backdropFilter: 'blur(8px)', padding: '12px 16px' }}
                    formatter={(value: any) => [formatRp(Number(value)), '']}
                  />
                </PieChart>
              </ResponsiveContainer>
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
