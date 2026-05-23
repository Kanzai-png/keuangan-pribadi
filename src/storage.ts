import type { Transaction, Period, DateRange } from './types';
import { supabase } from './supabase';

// Generate unique ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Auth functions
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Transaction CRUD
export async function loadTransactions(): Promise<Transaction[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
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
    type: row.type,
  }));
}

export async function addTransaction(t: Transaction): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase.from('transactions').insert({
    id: t.id,
    user_id: user.id,
    date: t.date,
    category: t.category,
    description: t.description,
    quantity: t.quantity,
    price: t.price,
    total: t.total,
    type: t.type,
  });
  return !error;
}

export async function updateTransaction(t: Transaction): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase.from('transactions')
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
    .eq('user_id', user.id);
  return !error;
}

export async function deleteTransaction(id: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase.from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  return !error;
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
