export function brl(n: number): string {
  const abs = Math.abs(n);
  const [int, dec] = abs.toFixed(2).split('.');
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '− ' : ''}R$ ${withDots},${dec}`;
}

/** Aceita '1.234,56', '1234.56', 'R$ 90' ... devolve número ou NaN */
export function parseMoney(input: string): number {
  let s = input.replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (s === '') return NaN;
  return Number(s);
}

export function moneyInput(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  return n.toFixed(2).replace('.', ',');
}

/** Tira acentos, deixa minúsculo, troca símbolos por espaço */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Versão do texto usada para regras: sem números (datas, códigos) */
export function rulePattern(description: string): string {
  return normalize(description).replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function pct(part: number, total: number): number {
  if (!total) return 0;
  return (part / total) * 100;
}
