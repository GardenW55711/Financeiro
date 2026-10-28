// Contas do painel: total gasto, por categoria, por conta, por ciclo.
import type { Category } from './categories';
import { cycleOf, PaySettings, PeriodKey, MonthPeriods } from './paydays';
import type { YM } from './dates';

export type TxForAnalysis = {
  id: string;
  date: string;
  amount: number;
  type: string;
  account_id: string | null;
  category_id: string | null;
  cycle_override: string | null;
};

export function isSpending(t: TxForAnalysis, excluded: Set<string>): boolean {
  return t.type === 'DEBIT' && !(t.category_id && excluded.has(t.category_id));
}

export function inPeriod(t: TxForAnalysis, key: PeriodKey, ym: YM, periods: MonthPeriods, st: PaySettings): boolean {
  if (key === 'mes') return t.date >= periods.mes.from && t.date <= periods.mes.to;
  const c = cycleOf(t.date, st);
  const effective = t.cycle_override === 'c5' || t.cycle_override === 'c20' ? t.cycle_override : c.key;
  return c.ym.y === ym.y && c.ym.m === ym.m && effective === key;
}

export type Slice = { id: string; name: string; color: string; value: number };

export function groupByCategory(txs: TxForAnalysis[], cats: Category[]): Slice[] {
  const byId = new Map(cats.map((c) => [c.id, c]));
  const sums = new Map<string, number>();
  for (const t of txs) {
    const k = t.category_id && byId.has(t.category_id) ? t.category_id : 'none';
    sums.set(k, (sums.get(k) || 0) + Math.abs(t.amount));
  }
  return Array.from(sums.entries())
    .map(([id, value]) => {
      const c = byId.get(id);
      return { id, value, name: c ? c.name : 'Sem categoria', color: c ? c.color : '#B45309' };
    })
    .sort((a, b) => b.value - a.value);
}

export function sum(txs: TxForAnalysis[]): number {
  return txs.reduce((a, t) => a + Math.abs(t.amount), 0);
}
