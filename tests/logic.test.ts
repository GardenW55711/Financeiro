import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cycleOf, day20Payment, DEFAULT_PAY_SETTINGS, easter, fifthBusinessDay, monthPeriods, nextPayday } from '../src/lib/paydays';
import { brl, parseMoney, rulePattern } from '../src/lib/format';
import { guessCategory, matchRule } from '../src/lib/categories';
import { billStatus, Bill } from '../src/lib/bills';

const st = DEFAULT_PAY_SETTINGS;

test('Páscoa', () => {
  assert.equal(easter(2026), '2026-04-05');
  assert.equal(easter(2027), '2027-03-28');
});

test('5º dia útil contando sábado', () => {
  assert.equal(fifthBusinessDay({ y: 2026, m: 10 }, st), '2026-10-06');
  // 1/nov domingo, 2/nov Finados -> 3,4,5,6,7(sáb)
  assert.equal(fifthBusinessDay({ y: 2026, m: 11 }, st), '2026-11-07');
  assert.equal(fifthBusinessDay({ y: 2026, m: 12 }, st), '2026-12-05');
  // 1/jan feriado (sex), 2 sáb, 4,5,6,7
  assert.equal(fifthBusinessDay({ y: 2027, m: 1 }, st), '2027-01-07');
});

test('5º dia útil sem sábado', () => {
  assert.equal(fifthBusinessDay({ y: 2026, m: 11 }, { ...st, countSaturday: false }), '2026-11-09');
});

test('dia 20 antecipa/adia', () => {
  assert.equal(day20Payment({ y: 2026, m: 11 }, st), '2026-11-19'); // feriado sexta
  assert.equal(day20Payment({ y: 2026, m: 12 }, st), '2026-12-18'); // domingo
  assert.equal(day20Payment({ y: 2026, m: 10 }, st), '2026-10-20');
  assert.equal(day20Payment({ y: 2026, m: 12 }, { ...st, rule20: 'adiar' }), '2026-12-21');
});

test('ciclos do mês', () => {
  const p = monthPeriods({ y: 2026, m: 10 }, st);
  assert.deepEqual(p.c5, { from: '2026-10-06', to: '2026-10-19' });
  assert.deepEqual(p.c20, { from: '2026-10-20', to: '2026-11-06' });
  assert.deepEqual(cycleOf('2026-10-28', st), { ym: { y: 2026, m: 10 }, key: 'c20' });
  assert.deepEqual(cycleOf('2026-11-03', st), { ym: { y: 2026, m: 10 }, key: 'c20' });
  assert.deepEqual(cycleOf('2026-10-10', st), { ym: { y: 2026, m: 10 }, key: 'c5' });
  assert.equal(nextPayday('2026-10-28', st), '2026-11-07');
  assert.equal(nextPayday('2026-11-07', st), '2026-11-19');
});

test('dinheiro', () => {
  assert.equal(brl(1234.5), 'R$ 1.234,50');
  assert.equal(brl(-64.9), '− R$ 64,90');
  assert.equal(parseMoney('1.234,56'), 1234.56);
  assert.equal(parseMoney('R$ 90'), 90);
  assert.equal(parseMoney('12.5'), 12.5);
});

test('categorias automáticas', () => {
  assert.equal(guessCategory('Groceries', 'SUPERMERCADO BOM PRECO'), 'alimentacao');
  assert.equal(guessCategory(null, 'IFOOD *PIZZARIA'), 'alimentacao');
  assert.equal(guessCategory('Credit card payment', 'PAGAMENTO FATURA'), 'fatura');
  assert.equal(guessCategory(null, 'UBER *TRIP 1234'), 'transporte');
  assert.equal(guessCategory(null, 'PIX ENVIADO J SILVA'), null);
  assert.equal(guessCategory(null, 'TIMES SQUARE'), null);
});

test('regras', () => {
  const rules = [{ id: 1, pattern: rulePattern('PIX ENVIADO · J. SILVA 27/10'), category_id: 'lazer', tags: '[]' }];
  assert.equal(matchRule(rules, 'PIX ENVIADO J. SILVA 03/11')?.category_id, 'lazer');
  assert.equal(matchRule(rules, 'PIX ENVIADO MARIA'), null);
});

test('conta fixa paga pelo extrato', () => {
  const bill: Bill = { id: 1, name: 'Aluguel', category_id: 'moradia', amount: 900, variable: 0, due_day: 25, cycle: 'c20', keyword: 'imobiliária', account_id: null, active: 1 };
  const txs = [{ id: 'a', date: '2026-10-21', description: 'PIX ENVIADO IMOBILIARIA XYZ', type: 'DEBIT', amount: -900 }];
  const s = billStatus(bill, { y: 2026, m: 10 }, txs, undefined);
  assert.equal(s.paid, true);
  assert.equal(s.paidDate, '2026-10-21');
  assert.equal(billStatus(bill, { y: 2026, m: 11 }, txs, undefined).paid, false);
  assert.equal(billStatus(bill, { y: 2026, m: 11 }, txs, { bill_id: 1, ym: '2026-11', paid: 1 }).paid, true);
  // dia 31 em fevereiro vira 28
  assert.equal(billStatus({ ...bill, due_day: 31 }, { y: 2027, m: 2 }, [], undefined).due, '2027-02-28');
});

import { compareVersions } from '../src/lib/version';

test('comparar versões', () => {
  assert.ok(compareVersions('1.0.12', '1.0.9') > 0);
  assert.ok(compareVersions('v1.0.3', '1.0.3') === 0);
  assert.ok(compareVersions('1.0.2', '1.0.10') < 0);
});

import { groupInvestments, mapInvestment } from '../src/lib/investments';

test('investimentos: valor, taxa e agrupamento', () => {
  const now = '2026-10-28T00:00:00Z';
  const cdb = mapInvestment({ id: 'a', name: 'CDB Banco X', type: 'FIXED_INCOME', subtype: 'CDB', balance: 1500.5, rate: 110, rateType: 'CDI', amountProfit: 50, dueDate: '2028-01-10T00:00:00Z', status: 'ACTIVE' }, 'i1', 'Nubank', now)!;
  assert.equal(cdb.balance, 1500.5);
  assert.equal(cdb.rate, '110% do CDI');
  assert.equal(cdb.due_date, '2028-01-10');
  const fundo = mapInvestment({ id: 'b', name: 'Fundo Y', type: 'MUTUAL_FUND', value: 10, quantity: 30 }, 'i1', 'Inter', now)!;
  assert.equal(fundo.balance, 300);
  assert.equal(mapInvestment({ id: 'c', type: 'EQUITY', balance: 9, status: 'TOTAL_WITHDRAWAL' }, 'i1', 'X', now), null);
  const g = groupInvestments([fundo, cdb]);
  assert.equal(g[0].label, 'Renda fixa');
  assert.equal(g[1].total, 300);
});

import { bankFromCode, bankOfAccount, bankOfInvestment } from '../src/lib/banks';

test('nome do banco por trás do MeuPluggy', () => {
  assert.equal(bankFromCode('0341'), 'Itaú');
  assert.equal(bankFromCode('260'), 'Nubank');
  assert.equal(bankOfAccount({ bankData: { transferNumber: '0341/1234/56789-0' }, name: 'Conta Corrente' }, 'MeuPluggy'), 'Itaú');
  assert.equal(bankOfAccount({ name: 'Nubank Ultravioleta', type: 'CREDIT' }, 'MeuPluggy'), 'Nubank');
  assert.equal(bankOfAccount({ name: 'NU PAGAMENTOS S.A.' }, 'MeuPluggy'), 'Nubank');
  assert.equal(bankOfAccount({ name: 'Conta' }, 'Itaú'), 'Itaú');
  assert.equal(bankOfAccount({ name: 'Conta Pessoal' }, 'MeuPluggy'), 'Conta Pessoal');
  assert.equal(bankOfInvestment({ institution: { name: 'XP INVESTIMENTOS CCTVM S/A', number: '102' }, issuer: 'Banco Master' }, 'MeuPluggy'), 'XP');
  assert.equal(bankOfAccount({ name: 'Caixinha Viagem' }, 'MeuPluggy'), 'Caixinha Viagem');
});

import { bazinPrice, estimatedIr, grahamPrice, grossEquivalent, irRate, portfolioAlerts, realReturn, safetyMargin, summarize, sumDividends12m, upcomingMaturities } from '../src/lib/portfolio';
import { readFii, readStock } from '../src/lib/indicators';
import { Investment } from '../src/lib/investments';

function inv(p: Partial<Investment>): Investment {
  return {
    id: Math.random().toString(36), item_id: 'i', bank_name: 'XP', name: 'X', type: 'FIXED_INCOME', subtype: 'CDB', balance: 1000,
    profit: null, due_date: null, rate: null, updated_at: null, code: null, quantity: null, invested: null, rate_12m: null,
    rate_month: null, purchase_date: null, issuer: null, index_type: null, source: 'pluggy', ...p,
  };
}

test('carteira: resumo, divisão e vencimentos', () => {
  const list = [
    inv({ name: 'CDB A', balance: 6000, invested: 5000, index_type: 'CDI', due_date: '2027-03-01' }),
    inv({ name: 'ITUB4', type: 'EQUITY', subtype: 'STOCK', code: 'ITUB4', balance: 3000, invested: 2500, bank_name: 'Nubank' }),
    inv({ name: 'Fundo Imobiliário Y', type: 'EQUITY', subtype: 'REAL_ESTATE_FUND', code: 'MXRF11', balance: 1000, invested: 1000 }),
  ];
  const s = summarize(list, '2026-10-28');
  assert.equal(s.total, 10000);
  assert.equal(s.invested, 8500);
  assert.equal(s.profit, 1500);
  assert.equal(Math.round(s.profitPct! * 10) / 10, 17.6);
  assert.deepEqual(s.byClass.map((x) => x.label), ['Renda fixa', 'Ação', 'FII']);
  assert.equal(s.byInstitution[0].label, 'XP');
  assert.equal(upcomingMaturities(list, '2026-10-28')[0].days, 124);
  const alerts = portfolioAlerts(list, s, 14);
  assert.ok(alerts.some((a) => a.title.includes('concentrado')));
});

test('imposto e comparações', () => {
  assert.equal(irRate(100), 22.5);
  assert.equal(irRate(400), 17.5);
  assert.equal(irRate(800), 15);
  const ir = estimatedIr(inv({ balance: 1100, invested: 1000, purchase_date: '2025-09-01' }), '2026-10-28');
  assert.equal(ir!.rate, 17.5);
  assert.equal(Math.round(ir!.value * 100) / 100, 17.5);
  assert.equal(estimatedIr(inv({ subtype: 'LCI', purchase_date: '2026-01-01', invested: 1 }), '2026-10-28')!.rate, 0);
  assert.equal(Math.round(grossEquivalent(90, 721) * 10) / 10, 105.9);
  assert.equal(Math.round(realReturn(10, 5) * 100) / 100, 4.76);
});

test('preço justo e indicadores', () => {
  assert.equal(Math.round(grahamPrice(4, 25)! * 100) / 100, 47.43);
  assert.equal(grahamPrice(-1, 25), null);
  assert.equal(bazinPrice(1.2, 6), 20);
  assert.equal(safetyMargin(20, 15), 25);
  assert.equal(sumDividends12m([{ date: '2026-09-01', value: 0.1 }, { date: '2025-01-01', value: 5 }], new Date('2026-10-28')), 0.1);
  const q = { price: 30, pl: 8, pvp: 1.2, dy: 7, roe: 20, netMargin: 15, debtToEquity: 0.4, evEbitda: 5, lpa: 3.75, vpa: 25, dividends12m: 2.1 };
  assert.ok(readStock(q).every((r) => r.verdict === 'bom'));
  assert.equal(readFii({ ...q, pvp: 1.4 }, 14).find((r) => r.key === 'pvp')!.verdict, 'atencao');
});
