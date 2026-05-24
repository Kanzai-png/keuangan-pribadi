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

    // Colors matching template
    const TEAL_DARK = 'FF1A7A7A';
    const TEAL = 'FF2E9E9E';
    const WHITE = 'FFFFFFFF';
    const BLACK = 'FF000000';
    const BLUE = 'FF0000FF';
    const RED_TEXT = 'FFFF0000';
    const GRAY = 'FF555555';
    const LIGHT_GRAY = 'FFAAAAAA';
    const ALT_ROW = 'FFF9F9F9';
    const TOTAL_ROW = 'FFE0F5F5';
    const BORDER_COLOR = 'FF000000';

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: BORDER_COLOR } },
      bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
      left: { style: 'thin', color: { argb: BORDER_COLOR } },
      right: { style: 'thin', color: { argb: BORDER_COLOR } },
    };

    const rpFmt = '#,##0';
    const pctFmt = '0.00%';

    // ========== SHEET 1: REPORT ==========
    const ws = wb.addWorksheet('Report', { properties: { tabColor: { argb: '14B8A6' } } });
    ws.columns = [
      { width: 22 }, { width: 18 }, { width: 18 }, { width: 35 },
      { width: 12 }, { width: 4 }, { width: 14 }, { width: 16 },
    ];

    // Row 1: Title
    ws.mergeCells('A1:C1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'Money Management Dashboard';
    titleCell.font = { bold: true, size: 16, color: { argb: TEAL_DARK.replace('FF','') } };
    titleCell.alignment = { horizontal: 'left', vertical: "middle" };
    ws.getRow(1).height = 30;

    const dateCell = ws.getCell('D1');
    dateCell.value = `Year: ${currentYear}     Month: ${currentMonth}`;
    dateCell.font = { size: 10, color: { argb: GRAY.replace('FF','') } };
    dateCell.alignment = { horizontal: 'right', vertical: "middle" };

    // Row 2: Section header
    ws.mergeCells('A2:E2');
    const sectionCell = ws.getCell('A2');
    sectionCell.value = 'Monthly Report';
    sectionCell.font = { bold: true, size: 11, color: { argb: WHITE.replace('FF','') } };
    sectionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_DARK.replace('FF','') } };
    sectionCell.alignment = { horizontal: 'center', vertical: "middle" };
    ws.getRow(2).height = 21.75;

    // Row 3: Summary headers
    const summaryHeaders = ['Total Income', 'December Savings', 'December Spending', 'Balance Bank 1'];
    summaryHeaders.forEach((h, i) => {
      const cell = ws.getCell(3, i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 9, color: { argb: WHITE.replace('FF','') } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL.replace('FF','') } };
      cell.alignment = { horizontal: 'center', vertical: "middle" };
      cell.border = thinBorder;
    });
    ws.getRow(3).height = 18;

    // Row 4: Summary values
    const summaryVals = [
      { val: totalMasuk, color: BLUE },
      { val: saldo > 0 ? saldo : 0, color: BLUE },
      { val: totalKeluar, color: BLACK },
      { val: saldo, color: BLACK },
    ];
    summaryVals.forEach((s, i) => {
      const cell = ws.getCell(4, i + 1);
      cell.value = s.val;
      cell.font = { bold: true, size: 13, color: { argb: s.color.replace('FF','') } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WHITE.replace('FF','') } };
      cell.alignment = { horizontal: 'center', vertical: "middle" };
      cell.border = thinBorder;
      cell.numFmt = rpFmt;
    });
    ws.getRow(4).height = 24;

    // Row 5: Spacer
    ws.getRow(5).height = 6;

    // Row 6: Expenses header
    const expHeaders = ['Expenses List', 'Allocation', 'Realization', 'Budget Usage Progress', '% Usage'];
    expHeaders.forEach((h, i) => {
      const cell = ws.getCell(6, i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 9, color: { argb: WHITE.replace('FF','') } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL.replace('FF','') } };
      cell.alignment = { horizontal: 'center', vertical: "middle" };
      cell.border = thinBorder;
    });
    ws.getRow(6).height = 18;

    // Rows 7+: Expense data with alternating colors
    let dataRow = 7;
    const expenseEntries = Object.entries(expensesDashboard);
    expenseEntries.forEach(([cat, { allocation, realization }], idx) => {
      const isAlt = idx % 2 === 1;
      const bgColor = isAlt ? ALT_ROW.replace('FF','') : WHITE.replace('FF','');
      const usage = allocation > 0 ? realization / allocation : 0;
      const isOver = usage > 1;
      const usageFontColor = isOver ? RED_TEXT.replace('FF','') : BLACK.replace('FF','');

      const row = ws.getRow(dataRow);
      row.height = 15.75;

      // A: Category
      const catCell = ws.getCell(dataRow, 1);
      catCell.value = cat;
      catCell.font = { size: 9 };
      catCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      catCell.alignment = { vertical: "middle" };
      catCell.border = thinBorder;

      // B: Allocation
      const allocCell = ws.getCell(dataRow, 2);
      allocCell.value = allocation;
      allocCell.font = { size: 9, color: { argb: BLUE.replace('FF','') } };
      allocCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      allocCell.alignment = { horizontal: 'right', vertical: "middle" };
      allocCell.border = thinBorder;
      allocCell.numFmt = rpFmt;

      // C: Realization
      const realCell = ws.getCell(dataRow, 3);
      realCell.value = realization;
      realCell.font = { size: 9, color: { argb: BLUE.replace('FF','') } };
      realCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      realCell.alignment = { horizontal: 'right', vertical: "middle" };
      realCell.border = thinBorder;
      realCell.numFmt = rpFmt;

      // D: Budget Usage Progress (formula with percentage bar text)
      const progCell = ws.getCell(dataRow, 4);
      progCell.value = { formula: `IFERROR(C${dataRow}/B${dataRow},0)` };
      progCell.font = { size: 9, color: { argb: LIGHT_GRAY.replace('FF','') } };
      progCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      progCell.alignment = { horizontal: 'left', vertical: "middle" };
      progCell.border = thinBorder;
      progCell.numFmt = pctFmt;

      // E: % Usage (number, colored red if over budget)
      const usageCell = ws.getCell(dataRow, 5);
      usageCell.value = { formula: `IFERROR(C${dataRow}/B${dataRow},0)` };
      usageCell.font = { size: 9, color: { argb: usageFontColor } };
      usageCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      usageCell.alignment = { horizontal: 'right', vertical: "middle" };
      usageCell.border = thinBorder;
      usageCell.numFmt = pctFmt;

      dataRow++;
    });

    // TOTAL row
    const totalRow = ws.getRow(dataRow);
    totalRow.height = 18;
    ['TOTAL', { formula: `SUM(B7:B${dataRow-1})` }, { formula: `SUM(C7:C${dataRow-1})` }, '', { formula: `IFERROR(C${dataRow}/B${dataRow},0)` }].forEach((val, i) => {
      const cell = ws.getCell(dataRow, i + 1);
      cell.value = val;
      cell.font = { bold: true, size: 9 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_ROW.replace('FF','') } };
      cell.alignment = { horizontal: i >= 1 ? 'right' : 'left', vertical: 'bottom' };
      cell.border = thinBorder;
      if (i >= 1 && i <= 2) cell.numFmt = rpFmt;
      if (i === 4) cell.numFmt = pctFmt;
    });

    // Chart data rows (for line chart) - placed in G:H
    ws.getCell('G1').value = 'Month';
    ws.getCell('G1').font = { size: 11 };
    ws.getCell('H1').value = 'Spending';
    ws.getCell('H1').font = { size: 11 };

    // Monthly spending data for chart
    const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const sortedMonths = Object.keys(monthlyData).sort();
    sortedMonths.forEach((m, i) => {
      const [, mo] = m.split('-');
      const row = i + 2;
      ws.getCell(`G${row}`).value = monthLabels[parseInt(mo)-1];
      ws.getCell(`H${row}`).value = monthlyData[m].keluar;
      ws.getCell(`H${row}`).numFmt = rpFmt;
    });

    // Embed charts as images
    const chartStartRow = dataRow + 2;

    if (doughnutRef.current) {
      const canvas = doughnutRef.current.canvas;
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      const imgId = wb.addImage({ base64, extension: 'png' });
      ws.addImage(imgId, { tl: { col: 0, row: chartStartRow }, ext: { width: 350, height: 250 } });
    }

    if (barRef.current) {
      const canvas = barRef.current.canvas;
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      const imgId = wb.addImage({ base64, extension: 'png' });
      ws.addImage(imgId, { tl: { col: 3, row: chartStartRow }, ext: { width: 450, height: 250 } });
    }

    // ========== SHEET 2: BUDGETING ==========
    const wsBudget = wb.addWorksheet('Budgeting', { properties: { tabColor: { argb: '6366F1' } } });
    wsBudget.columns = [{ width: 25 }, { width: 20 }, { width: 18 }, { width: 18 }];

    wsBudget.mergeCells('A1:D1');
    const budgetTitle = wsBudget.getCell('A1');
    budgetTitle.value = 'Budgeting Sheet';
    budgetTitle.font = { bold: true, size: 13, color: { argb: WHITE.replace('FF','') } };
    budgetTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_DARK.replace('FF','') } };
    budgetTitle.alignment = { horizontal: 'center', vertical: "middle" };
    wsBudget.getRow(1).height = 24;

    ['Category', 'Monthly Budget', 'YTD Spent', 'Remaining'].forEach((h, i) => {
      const cell = wsBudget.getCell(2, i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 9, color: { argb: WHITE.replace('FF','') } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL.replace('FF','') } };
      cell.alignment = { horizontal: 'center', vertical: 'bottom' };
      cell.border = thinBorder;
    });

    expenseEntries.forEach(([cat, { allocation, realization }], idx) => {
      const row = idx + 3;
      wsBudget.getCell(row, 1).value = cat;
      wsBudget.getCell(row, 1).font = { size: 11 };
      wsBudget.getCell(row, 1).border = thinBorder;

      wsBudget.getCell(row, 2).value = allocation;
      wsBudget.getCell(row, 2).font = { size: 11, color: { argb: BLUE.replace('FF','') } };
      wsBudget.getCell(row, 2).border = thinBorder;
      wsBudget.getCell(row, 2).numFmt = rpFmt;

      wsBudget.getCell(row, 3).value = realization;
      wsBudget.getCell(row, 3).font = { size: 11, color: { argb: BLUE.replace('FF','') } };
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
    const sumTitle = wsSummary.getCell('A1');
    sumTitle.value = 'Monthly Summary';
    sumTitle.font = { bold: true, size: 13, color: { argb: WHITE.replace('FF','') } };
    sumTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_DARK.replace('FF','') } };
    sumTitle.alignment = { horizontal: 'center', vertical: "middle" };
    wsSummary.getRow(1).height = 24;

    const summaryRows = [
      ['Total Income', totalMasuk],
      ['Total Savings', saldo > 0 ? saldo : 0],
      ['Total Spending', totalKeluar],
      ['Balance', saldo],
    ];
    summaryRows.forEach(([label, val], i) => {
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

    // Savings Rate
    wsSummary.getCell(7, 1).value = 'Savings Rate';
    wsSummary.getCell(7, 1).font = { size: 10 };
    wsSummary.getCell(7, 1).border = thinBorder;
    wsSummary.getCell(7, 2).value = totalMasuk > 0 ? saldo / totalMasuk : 0;
    wsSummary.getCell(7, 2).font = { size: 10 };
    wsSummary.getCell(7, 2).alignment = { horizontal: 'right' };
    wsSummary.getCell(7, 2).border = thinBorder;
    wsSummary.getCell(7, 2).numFmt = '0.0%';

    wsSummary.getCell(8, 1).value = 'Spending Rate';
    wsSummary.getCell(8, 1).font = { size: 10 };
    wsSummary.getCell(8, 1).border = thinBorder;
    wsSummary.getCell(8, 2).value = totalMasuk > 0 ? totalKeluar / totalMasuk : 0;
    wsSummary.getCell(8, 2).font = { size: 10 };
    wsSummary.getCell(8, 2).alignment = { horizontal: 'right' };
    wsSummary.getCell(8, 2).border = thinBorder;
    wsSummary.getCell(8, 2).numFmt = '0.0%';

    // ========== SHEET 4: SPENDING (Transactions) ==========
    const wsTx = wb.addWorksheet('Spending', { properties: { tabColor: { argb: 'EF4444' } } });
    wsTx.columns = [
      { width: 14 }, { width: 18 }, { width: 28 }, { width: 16 },
    ];

    wsTx.mergeCells('A1:D1');
    const txTitle = wsTx.getCell('A1');
    txTitle.value = 'Daily Spending Log';
    txTitle.font = { bold: true, size: 13, color: { argb: WHITE.replace('FF','') } };
    txTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_DARK.replace('FF','') } };
    txTitle.alignment = { horizontal: 'center', vertical: "middle" };
    wsTx.getRow(1).height = 24;

    ['Date', 'Category', 'Description', 'Amount'].forEach((h, i) => {
      const cell = wsTx.getCell(2, i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 9, color: { argb: WHITE.replace('FF','') } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL.replace('FF','') } };
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

    // TOTAL row
    const txTotalRow = keluarOnly.length + 3;
    wsTx.getCell(txTotalRow, 3).value = 'TOTAL';
    wsTx.getCell(txTotalRow, 3).font = { bold: true, size: 9 };
    wsTx.getCell(txTotalRow, 4).value = { formula: `SUM(D3:D${txTotalRow - 1})` };
    wsTx.getCell(txTotalRow, 4).font = { bold: true, size: 9 };
    wsTx.getCell(txTotalRow, 4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_ROW.replace('FF','') } };
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
