// Junta tudo que uma tela precisa para um mês, num só lugar.
import { Account, getPaySettings, listAccounts, listBillManual, listBills, listCategories, listTransactions, Tx } from './db';
import { addDays, addMonths, monthEnd, monthStart, ymKey, YM } from './lib/dates';
import { Bill, billStatus, BillManual, BillStatus } from './lib/bills';
import { Category } from './lib/categories';
import { monthPeriods, MonthPeriods, PaySettings } from './lib/paydays';

export type MonthData = {
  ym: YM;
  settings: PaySettings;
  periods: MonthPeriods;
  prevPeriods: MonthPeriods;
  cats: Category[];
  excluded: Set<string>;
  accounts: Account[];
  txs: Tx[]; // janela: mês anterior até o fim do mês seguinte
  bills: Bill[];
  manual: BillManual[];
};

export async function loadMonth(ym: YM): Promise<MonthData> {
  const [settings, cats, accounts, bills, manual] = await Promise.all([
    getPaySettings(), listCategories(), listAccounts(), listBills(), listBillManual(),
  ]);
  const from = addDays(monthStart(addMonths(ym, -1)), -20);
  const to = addDays(monthEnd(addMonths(ym, 1)), 10);
  const txs = await listTransactions({ from, to });
  return {
    ym,
    settings,
    periods: monthPeriods(ym, settings),
    prevPeriods: monthPeriods(addMonths(ym, -1), settings),
    cats,
    excluded: new Set(cats.filter((c) => c.excluded).map((c) => c.id)),
    accounts,
    txs,
    bills,
    manual,
  };
}

export type BillView = Bill & { status: BillStatus; value: number; estimated: boolean };

/** Contas fixas do mês com situação (paga/aberta) e valor (fatura do cartão vinculado, se houver). */
export function billsForMonth(d: Pick<MonthData, 'bills' | 'manual' | 'txs' | 'accounts'>, ym: YM): BillView[] {
  const key = ymKey(ym);
  return d.bills.map((b) => {
    const manual = d.manual.find((m) => m.bill_id === b.id && m.ym === key);
    const status = billStatus(b, ym, d.txs, manual);
    const acc = b.account_id ? d.accounts.find((a) => a.id === b.account_id) : undefined;
    const fromCard = acc && typeof acc.balance === 'number' ? Math.abs(acc.balance) : null;
    return {
      ...b,
      status,
      value: fromCard ?? b.amount,
      estimated: fromCard !== null ? !status.paid : b.variable === 1,
    };
  });
}
