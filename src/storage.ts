import type { Transaction, Period, DateRange } from './types';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Storage using localStorage keyed by user ID
function getStorageKey(userId: string): string {
  return `kenzai_transactions_${userId}`;
}

export function loadTransactions(userId: string): Transaction[] {
  const raw = localStorage.getItem(getStorageKey(userId));
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveTransactions(userId: string, transactions: Transaction[]): void {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(transactions));
}

// Period filter
export function filterByPeriod(transactions: Transaction[], period: Period, customRange?: DateRange): Transaction[] {
  const now = new Date();
  let start: Date;

  switch (period) {
    case '1w':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '1m':
      start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case '3m':
      start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case '1y':
      start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    case 'custom':
      if (customRange?.start && customRange?.end) {
        const s = new Date(customRange.start);
        const e = new Date(customRange.end + 'T23:59:59');
        return transactions.filter(t => {
          const d = new Date(t.date);
          return d >= s && d <= e;
        });
      }
      return transactions;
    case 'all':
    default:
      return transactions;
  }

  return transactions.filter(t => new Date(t.date) >= start);
}
