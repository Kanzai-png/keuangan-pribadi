export interface Transaction {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  type: 'masuk' | 'keluar';
}

export type Period = '1w' | '1m' | '3m' | 'all';
