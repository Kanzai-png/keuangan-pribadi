import type { Transaction, Period, DateRange } from './types';
import { createClient } from '@supabase/supabase-js';

function getClient(userId?: string) {
  return createClient(
    'https://heuqbytnhgidaqzcxcry.supabase.co',
    'sb_publishable_mJ9SScZw_pAlPtJL67BjUw_U6k1knur',
    userId ? { global: { headers: { 'x-user-id': userId } } } : undefined
  );
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function loadTransactions(userId: string): Promise<Transaction[]> {
  const { data, error } = await getClient(userId)
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    console.error('Load error:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    date: row.date,
    category: row.category,
    description: row.description,
    quantity: row.quantity,
    price: row.price,
    total: row.total,
    type: row.type as 'masuk' | 'keluar',
  }));
}

export async function addTransaction(userId: string, t: Transaction): Promise<boolean> {
  const { error } = await getClient(userId)
    .from('transactions')
    .insert({
      id: t.id,
      user_id: userId,
      date: t.date,
      category: t.category,
      description: t.description,
      quantity: t.quantity,
      price: t.price,
      total: t.total,
      type: t.type,
    });

  if (error) {
    console.error('Insert error:', error);
    return false;
  }
  return true;
}

export async function updateTransaction(userId: string, t: Transaction): Promise<boolean> {
  const { error } = await getClient(userId)
    .from('transactions')
    .update({
      date: t.date,
      category: t.category,
      description: t.description,
      quantity: t.quantity,
      price: t.price,
      total: t.total,
      type: t.type,
    })
    .eq('id', t.id)
    .eq('user_id', userId);

  if (error) {
    console.error('Update error:', error);
    return false;
  }
  return true;
}

export async function deleteTransaction(userId: string, id: string): Promise<boolean> {
  const { error } = await getClient(userId)
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Delete error:', error);
    return false;
  }
  return true;
}

// Period filter (client-side)
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
