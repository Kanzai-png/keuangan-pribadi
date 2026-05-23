import type { Transaction } from './types';

const STORAGE_KEY = 'keuangan_transactions';

export function getTransactions(): Transaction[] {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveTransactions(transactions: Transaction[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

export function addTransaction(tx: Transaction): Transaction[] {
  const transactions = getTransactions();
  transactions.unshift(tx);
  saveTransactions(transactions);
  return transactions;
}

export function deleteTransaction(id: string): Transaction[] {
  const transactions = getTransactions().filter(t => t.id !== id);
  saveTransactions(transactions);
  return transactions;
}

export function filterByPeriod(transactions: Transaction[], period: string): Transaction[] {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case '1w':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '1m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case '3m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    default:
      return transactions;
  }

  return transactions.filter(t => new Date(t.date) >= startDate);
}

export function exportCSV(transactions: Transaction[]): void {
  const header = 'Tanggal,Kategori,Deskripsi,Jumlah,Tipe\n';
  const rows = transactions.map(t =>
    `${t.date},${t.category},${t.description},${t.amount},${t.type}`
  ).join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `keuangan_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
