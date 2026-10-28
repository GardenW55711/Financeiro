// Contas fixas: calcula vencimento do mês e se já foi paga.
import { addDays, daysInMonth, ymd, YM } from './dates';
import { normalize } from './format';

export type Bill = {
  id: number;
  name: string;
  category_id: string | null;
  amount: number;
  variable: number; // 1 = valor muda todo mês (estimativa)
  due_day: number;
  cycle: 'c5' | 'c20';
  keyword: string;
  account_id: string | null; // cartão vinculado (valor = fatura atual)
  active: number;
};

export type BillManual = { bill_id: number; ym: string; paid: number };

export type TxLite = { id: string; date: string; description: string; display_name?: string | null; type: string; amount: number };

export function billDueDate(bill: Pick<Bill, 'due_day'>, ym: YM): string {
  const d = Math.min(Math.max(1, bill.due_day), daysInMonth(ym.y, ym.m));
  return ymd(ym.y, ym.m, d);
}

export type BillStatus = {
  due: string;
  paid: boolean;
  paidDate: string | null;
  source: 'auto' | 'manual' | null;
};

/**
 * Procura no extrato um gasto com a palavra-chave da conta perto do vencimento
 * (de 20 dias antes até 10 dias depois). Uma marcação manual sempre vence.
 */
export function billStatus(bill: Bill, ym: YM, txs: TxLite[], manual: BillManual | undefined): BillStatus {
  const due = billDueDate(bill, ym);
  if (manual) {
    return { due, paid: manual.paid === 1, paidDate: null, source: 'manual' };
  }
  const kw = normalize(bill.keyword || '');
  if (kw) {
    const from = addDays(due, -20);
    const to = addDays(due, 10);
    const hit = txs
      .filter((t) => t.type === 'DEBIT' && t.date >= from && t.date <= to)
      .find((t) => normalize(`${t.description} ${t.display_name ?? ''}`).includes(kw));
    if (hit) return { due, paid: true, paidDate: hit.date, source: 'auto' };
  }
  return { due, paid: false, paidDate: null, source: null };
}
