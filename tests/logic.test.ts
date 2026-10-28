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
