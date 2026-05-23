import type { Transaction, DateRange } from './types';

const REPO = 'Kanzai-png/keuangan-pribadi';
const FILE_PATH = 'data/transactions.json';
const BRANCH = 'master';

let githubToken = '';

export function setGithubToken(token: string) {
  githubToken = token;
  localStorage.setItem('gh_token', token);
}

export function getGithubToken(): string {
  if (!githubToken) {
    githubToken = localStorage.getItem('gh_token') || '';
  }
  return githubToken;
}

async function getFileSha(): Promise<string | null> {
  const token = getGithubToken();
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) {
      const data = await res.json();
      return data.sha;
    }
  } catch {}
  return null;
}

export async function loadFromGithub(): Promise<Transaction[]> {
  const token = getGithubToken();
  if (!token) return loadFromLocal();
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) {
      const data = await res.json();
      const content = atob(data.content);
      const transactions = JSON.parse(content);
      localStorage.setItem('keuangan_transactions', JSON.stringify(transactions));
      return transactions;
    }
  } catch {}
  return loadFromLocal();
}

export async function saveToGithub(transactions: Transaction[]): Promise<boolean> {
  const token = getGithubToken();
  if (!token) {
    saveToLocal(transactions);
    return false;
  }
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(transactions, null, 2))));
  const sha = await getFileSha();
  const body: Record<string, string> = {
    message: `update transactions ${new Date().toISOString().split('T')[0]}`,
    content,
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    if (res.ok) {
      saveToLocal(transactions);
      return true;
    }
  } catch {}
  saveToLocal(transactions);
  return false;
}

export function loadFromLocal(): Transaction[] {
  const data = localStorage.getItem('keuangan_transactions');
  return data ? JSON.parse(data) : [];
}

export function saveToLocal(transactions: Transaction[]): void {
  localStorage.setItem('keuangan_transactions', JSON.stringify(transactions));
}

export function filterByPeriod(
  transactions: Transaction[],
  period: string,
  customRange?: DateRange
): Transaction[] {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

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
    case '1y':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    case 'custom':
      if (!customRange) return transactions;
      startDate = new Date(customRange.start);
      endDate = new Date(customRange.end);
      endDate.setHours(23, 59, 59, 999);
      break;
    default:
      return transactions;
  }

  return transactions.filter(t => {
    const d = new Date(t.date);
    return d >= startDate && d <= endDate;
  });
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
