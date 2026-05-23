export interface Transaction {
  id: string;
  date: string;
  category: string;
  description: string;
  quantity: number;
  price: number;
  total: number;
  type: 'masuk' | 'keluar';
}

export type Period = '1w' | '1m' | '3m' | '1y' | 'custom' | 'all';

export interface DateRange {
  start: string;
  end: string;
}
