// Datas são guardadas como texto 'AAAA-MM-DD' (sem fuso horário),
// assim um gasto do dia 27 nunca "pula" para o dia 26 por causa do fuso.

export type YM = { y: number; m: number }; // m = 1..12

const pad = (n: number) => String(n).padStart(2, '0');

export function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseYmd(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

export function todayYmd(): string {
  const t = new Date();
  return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/** 0 = domingo ... 6 = sábado */
export function weekday(s: string): number {
  const { y, m, d } = parseYmd(s);
  return new Date(y, m - 1, d).getDay();
}

export function addDays(s: string, n: number): string {
  const { y, m, d } = parseYmd(s);
  const t = new Date(y, m - 1, d + n);
  return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

export function addMonths(ym: YM, n: number): YM {
  const idx = ym.y * 12 + (ym.m - 1) + n;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

export function ymOf(s: string): YM {
  const { y, m } = parseYmd(s);
  return { y, m };
}

export function ymKey(ym: YM): string {
  return `${ym.y}-${pad(ym.m)}`;
}

export function monthStart(ym: YM): string {
  return ymd(ym.y, ym.m, 1);
}

export function monthEnd(ym: YM): string {
  return ymd(ym.y, ym.m, daysInMonth(ym.y, ym.m));
}

export function diffDays(a: string, b: string): number {
  const pa = parseYmd(a);
  const pb = parseYmd(b);
  const ta = Date.UTC(pa.y, pa.m - 1, pa.d);
  const tb = Date.UTC(pb.y, pb.m - 1, pb.d);
  return Math.round((tb - ta) / 86400000);
}

export const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function monthLabel(ym: YM): string {
  const name = MONTHS[ym.m - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${ym.y}`;
}

/** '2026-11-07' -> '07/nov' */
export function shortDate(s: string): string {
  const { m, d } = parseYmd(s);
  return `${pad(d)}/${MONTHS_SHORT[m - 1]}`;
}

/** '2026-11-07' -> '07/11' */
export function ddmm(s: string): string {
  const { m, d } = parseYmd(s);
  return `${pad(d)}/${pad(m)}`;
}

/** '2026-11-07' -> 'Sábado, 7 de novembro' */
export function longDate(s: string): string {
  const { m, d } = parseYmd(s);
  return `${WEEKDAYS[weekday(s)]}, ${d} de ${MONTHS[m - 1]}`;
}
