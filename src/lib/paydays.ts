// Regras de pagamento: 5º dia útil e dia 20.
// Pense nisso como o "relógio" do app: tudo (ciclos, calendário, contas)
// depende de saber em que dia cada salário cai.

import { addDays, addMonths, daysInMonth, monthEnd, monthStart, parseYmd, weekday, ymd, YM } from './dates';

export type PaySettings = {
  /** Sábado conta como dia útil para o 5º dia útil */
  countSaturday: boolean;
  /** Pular feriados nacionais na contagem */
  skipHolidays: boolean;
  /** Se o dia 20 cair em fim de semana/feriado: antecipa ou adia */
  rule20: 'antecipar' | 'adiar';
};

export const DEFAULT_PAY_SETTINGS: PaySettings = {
  countSaturday: true,
  skipHolidays: true,
  rule20: 'antecipar',
};

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher) */
export function easter(y: number): string {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(y, month, day);
}

const FIXED_HOLIDAYS: Record<string, string> = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalho',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Senhora Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '11-20': 'Consciência Negra',
  '12-25': 'Natal',
};

/** Feriados nacionais do ano: { 'AAAA-MM-DD': 'nome' } */
export function nationalHolidays(y: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [md, name] of Object.entries(FIXED_HOLIDAYS)) out[`${y}-${md}`] = name;
  out[addDays(easter(y), -2)] = 'Sexta-feira Santa';
  return out;
}

export function holidayName(s: string): string | null {
  const { y } = parseYmd(s);
  return nationalHolidays(y)[s] ?? null;
}

function isHoliday(s: string, st: PaySettings): boolean {
  return st.skipHolidays && holidayName(s) !== null;
}

/** Dia útil para contagem do 5º dia útil (sábado conta se configurado) */
function isCountedBusinessDay(s: string, st: PaySettings): boolean {
  const wd = weekday(s);
  if (wd === 0) return false;
  if (wd === 6 && !st.countSaturday) return false;
  return !isHoliday(s, st);
}

/** Dia em que o banco efetivamente paga (segunda a sexta, sem feriado) */
function isBankDay(s: string, st: PaySettings): boolean {
  const wd = weekday(s);
  if (wd === 0 || wd === 6) return false;
  return !isHoliday(s, st);
}

export function fifthBusinessDay(ym: YM, st: PaySettings): string {
  let count = 0;
  const last = daysInMonth(ym.y, ym.m);
  for (let d = 1; d <= last; d++) {
    const s = ymd(ym.y, ym.m, d);
    if (isCountedBusinessDay(s, st)) {
      count++;
      if (count === 5) return s;
    }
  }
  return monthEnd(ym);
}

export function day20Payment(ym: YM, st: PaySettings): string {
  let s = ymd(ym.y, ym.m, 20);
  const step = st.rule20 === 'antecipar' ? -1 : 1;
  let guard = 0;
  while (!isBankDay(s, st) && guard < 10) {
    s = addDays(s, step);
    guard++;
  }
  return s;
}

export type PeriodKey = 'mes' | 'c5' | 'c20';
export type Range = { from: string; to: string }; // datas inclusivas

export type MonthPeriods = {
  mes: Range;
  c5: Range;
  c20: Range;
  pay5: string;
  pay20: string;
};

/**
 * Para um mês:
 *  - c5: do pagamento do 5º dia útil até a véspera do pagamento do dia 20
 *  - c20: do pagamento do dia 20 até a véspera do 5º dia útil do mês seguinte
 */
export function monthPeriods(ym: YM, st: PaySettings): MonthPeriods {
  const pay5 = fifthBusinessDay(ym, st);
  const pay20 = day20Payment(ym, st);
  const nextPay5 = fifthBusinessDay(addMonths(ym, 1), st);
  return {
    mes: { from: monthStart(ym), to: monthEnd(ym) },
    c5: { from: pay5, to: addDays(pay20, -1) },
    c20: { from: pay20, to: addDays(nextPay5, -1) },
    pay5,
    pay20,
  };
}

/** Descobre em qual ciclo uma data está: devolve o mês "dono" do ciclo e qual é */
export function cycleOf(date: string, st: PaySettings): { ym: YM; key: 'c5' | 'c20' } {
  const { y, m } = parseYmd(date);
  const ym = { y, m };
  const p = monthPeriods(ym, st);
  if (date >= p.c20.from) return { ym, key: 'c20' };
  if (date >= p.c5.from) return { ym, key: 'c5' };
  return { ym: addMonths(ym, -1), key: 'c20' };
}

/** Próximo dia de pagamento estritamente depois de `date` */
export function nextPayday(date: string, st: PaySettings): string {
  const { y, m } = parseYmd(date);
  for (let i = 0; i < 3; i++) {
    const p = monthPeriods(addMonths({ y, m }, i), st);
    for (const s of [p.pay5, p.pay20]) if (s > date) return s;
  }
  return addDays(date, 30);
}
