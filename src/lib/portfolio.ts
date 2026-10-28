// Contas da carteira de investimentos (sem depender do celular, para poder testar).
// Tudo aqui é matemática simples: somar, dividir e comparar.

import { Investment, typeLabel } from './investments';
import { diffDays } from './dates';

export type Slice = { key: string; label: string; value: number; pct: number; color: string };

const PALETTE = ['#0E6B57', '#0F4C5C', '#B45309', '#6D28D9', '#BE185D', '#2563EB', '#65A30D', '#8A8F98'];

function slices(map: Map<string, { label: string; value: number }>, total: number): Slice[] {
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, label: v.label, value: v.value, pct: total ? (v.value / total) * 100 : 0, color: '' }))
    .sort((a, b) => b.value - a.value)
    .map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }));
}

function add(map: Map<string, { label: string; value: number }>, key: string, label: string, v: number) {
  const cur = map.get(key) ?? { label, value: 0 };
  cur.value += v;
  map.set(key, cur);
}

/** É fundo imobiliário? Código terminado em 11 com cara de FII, ou subtipo de fundo imobiliário. */
export function isFii(i: Pick<Investment, 'code' | 'subtype' | 'name'>): boolean {
  if (i.subtype === 'REAL_ESTATE_FUND') return true;
  if (/\bfii\b|imobili/i.test(i.name || '')) return true;
  return false;
}

/** Ações, FIIs e ETFs (renda variável negociada na bolsa). */
export function isListed(i: Pick<Investment, 'type' | 'code' | 'subtype' | 'name'>): boolean {
  if (!i.code || !/^[A-Z]{4}\d{1,2}$/.test(i.code)) return false;
  return i.type === 'EQUITY' || i.type === 'ETF' || isFii(i) || /11$/.test(i.code);
}

/** Classe do ativo, do jeito que o investidor fala. */
export function assetClass(i: Investment): string {
  if (isFii(i)) return 'FII';
  if (i.type === 'EQUITY') return /11$/.test(i.code ?? '') ? 'FII' : 'Ação';
  if (i.type === 'ETF') return 'ETF';
  return typeLabel(i.type);
}

export function indexLabel(i: Investment): string {
  const t = (i.index_type ?? '').toUpperCase();
  const r = (i.rate ?? '').toUpperCase();
  if (i.type === 'EQUITY' || i.type === 'ETF' || isFii(i)) return 'Renda variável';
  if (t.includes('IPCA') || r.includes('IPCA')) return 'Inflação (IPCA)';
  if (t.includes('CDI') || r.includes('CDI') || t.includes('SELIC') || r.includes('SELIC')) return 'Pós-fixado (CDI/Selic)';
  if (t.includes('PRE') || r.includes('AO ANO')) return 'Prefixado';
  if (i.type === 'MUTUAL_FUND') return 'Fundos';
  return 'Outros';
}

// Tipos que contam com a garantia do FGC (até R$ 250 mil por CPF por instituição)
const FGC_SUBTYPES = new Set(['CDB', 'LCI', 'LCA', 'LC', 'RDB', 'LCD', 'LH', 'DPGE', 'SAVINGS']);
export const FGC_LIMIT = 250000;

export function hasFgc(i: Investment): boolean {
  return !!i.subtype && FGC_SUBTYPES.has(i.subtype);
}

export type Summary = {
  total: number;
  invested: number | null; // soma do aplicado, quando todos informam
  profit: number | null;
  profitPct: number | null;
  byClass: Slice[];
  byInstitution: Slice[];
  byIndex: Slice[];
  byLiquidity: Slice[];
  count: number;
};

export function summarize(list: Investment[], today: string): Summary {
  const total = list.reduce((s, i) => s + i.balance, 0);
  const known = list.filter((i) => i.invested !== null && i.invested > 0);
  // Só calcula o ganho com os que informam quanto foi aplicado
  const investedKnown = known.reduce((s, i) => s + (i.invested ?? 0), 0);
  const valueKnown = known.reduce((s, i) => s + i.balance, 0);
  const profitFromFields = list.some((i) => i.profit !== null) ? list.reduce((s, i) => s + (i.profit ?? 0), 0) : null;
  const profit = known.length ? valueKnown - investedKnown : profitFromFields;
  const profitPct = known.length && investedKnown ? ((valueKnown - investedKnown) / investedKnown) * 100 : null;

  const byClass = new Map<string, { label: string; value: number }>();
  const byInst = new Map<string, { label: string; value: number }>();
  const byIdx = new Map<string, { label: string; value: number }>();
  const byLiq = new Map<string, { label: string; value: number }>();
  for (const i of list) {
    const c = assetClass(i);
    add(byClass, c, c, i.balance);
    const inst = i.bank_name || 'Sem instituição';
    add(byInst, inst, inst, i.balance);
    const ix = indexLabel(i);
    add(byIdx, ix, ix, i.balance);
    const [k, l] = liquidityBucket(i, today);
    add(byLiq, k, l, i.balance);
  }
  return {
    total,
    invested: known.length === list.length && list.length ? investedKnown : null,
    profit,
    profitPct,
    byClass: slices(byClass, total),
    byInstitution: slices(byInst, total),
    byIndex: slices(byIdx, total),
    byLiquidity: slices(byLiq, total),
    count: list.length,
  };
}

function liquidityBucket(i: Investment, today: string): [string, string] {
  if (isListed(i)) return ['1bolsa', 'Na bolsa (vende em D+2)'];
  if (!i.due_date) return ['0livre', 'Sem vencimento informado'];
  const d = diffDays(today, i.due_date);
  if (d <= 365) return ['2ate1', 'Vence em até 1 ano'];
  if (d <= 365 * 3) return ['3ate3', 'Vence em 1 a 3 anos'];
  return ['4mais3', 'Vence em mais de 3 anos'];
}

/** Próximos vencimentos, do mais perto para o mais longe. */
export function upcomingMaturities(list: Investment[], today: string, limit = 8): (Investment & { days: number })[] {
  return list
    .filter((i) => i.due_date && i.due_date >= today)
    .map((i) => ({ ...i, days: diffDays(today, i.due_date as string) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, limit);
}

// ---------- Imposto de renda (regras em vigor em 2026) ----------

const IR_EXEMPT = new Set(['LCI', 'LCA', 'CRI', 'CRA', 'LCD', 'LH']);

/** Alíquota da tabela regressiva da renda fixa, pelos dias aplicados. */
export function irRate(days: number): number {
  if (days <= 180) return 22.5;
  if (days <= 360) return 20;
  if (days <= 720) return 17.5;
  return 15;
}

/** IR que seria descontado se resgatasse hoje (renda fixa e fundos). null se não dá para calcular. */
export function estimatedIr(i: Investment, today: string): { rate: number; value: number } | null {
  if (i.subtype && IR_EXEMPT.has(i.subtype)) return { rate: 0, value: 0 };
  if (i.type !== 'FIXED_INCOME' && i.type !== 'MUTUAL_FUND') return null;
  if (!i.purchase_date || i.invested === null) return null;
  const gain = i.balance - i.invested;
  const rate = irRate(diffDays(i.purchase_date, today));
  return { rate, value: gain > 0 ? (gain * rate) / 100 : 0 };
}

// ---------- Comparações ----------

/** Rentabilidade real: quanto rendeu acima da inflação. Taxas em % (ex.: 12 e 4,5). */
export function realReturn(nominalPct: number, inflationPct: number): number {
  return ((1 + nominalPct / 100) / (1 + inflationPct / 100) - 1) * 100;
}

/** Quanto um investimento isento (LCI/LCA) equivale num tributado (CDB), no mesmo prazo. */
export function grossEquivalent(exemptPct: number, days: number): number {
  return exemptPct / (1 - irRate(days) / 100);
}

/** Quanto do CDI o investimento rendeu (ex.: 11% contra CDI de 10% = 110% do CDI). */
export function pctOfCdi(ratePct: number, cdiPct: number): number | null {
  if (!cdiPct) return null;
  return (ratePct / cdiPct) * 100;
}

// ---------- Preço justo (métodos clássicos) ----------

/** Benjamin Graham: √(22,5 × LPA × VPA). LPA = lucro por ação; VPA = valor patrimonial por ação. */
export function grahamPrice(lpa: number, vpa: number): number | null {
  if (!(lpa > 0) || !(vpa > 0)) return null;
  return Math.sqrt(22.5 * lpa * vpa);
}

/** Décio Bazin: dividendos pagos em 12 meses ÷ rendimento mínimo desejado (padrão 6%). */
export function bazinPrice(dividends12m: number, minYieldPct = 6): number | null {
  if (!(dividends12m > 0) || !(minYieldPct > 0)) return null;
  return dividends12m / (minYieldPct / 100);
}

/** Margem de segurança: quanto o preço está abaixo (+) ou acima (−) do preço justo, em %. */
export function safetyMargin(fair: number | null, price: number | null): number | null {
  if (!fair || !price) return null;
  return ((fair - price) / fair) * 100;
}

// ---------- Alertas ----------

export type Alert = { tone: 'warn' | 'info' | 'ok'; title: string; text: string };

export function portfolioAlerts(list: Investment[], s: Summary, cdi12m: number | null): Alert[] {
  const out: Alert[] = [];
  if (!list.length) return out;
  const big = [...list].sort((a, b) => b.balance - a.balance)[0];
  if (list.length > 1 && s.total && big.balance / s.total > 0.4) {
    out.push({ tone: 'warn', title: 'Dinheiro concentrado num só ativo', text: `${big.name} é ${Math.round((big.balance / s.total) * 100)}% da carteira. Se algo der errado com ele, pesa muito no total.` });
  }
  const topInst = s.byInstitution[0];
  if (s.byInstitution.length > 0 && topInst && topInst.pct > 70 && list.length > 1) {
    out.push({ tone: 'info', title: `Quase tudo em ${topInst.label}`, text: `${Math.round(topInst.pct)}% está numa só instituição. Não é errado, mas vale saber o risco se ela tiver problema.` });
  }
  const fgcByInst = new Map<string, number>();
  list.filter(hasFgc).forEach((i) => fgcByInst.set(i.issuer || i.bank_name || '?', (fgcByInst.get(i.issuer || i.bank_name || '?') || 0) + i.balance));
  for (const [inst, v] of fgcByInst) {
    if (v > FGC_LIMIT) out.push({ tone: 'warn', title: `Acima da garantia do FGC em ${inst}`, text: `O FGC cobre até R$ 250 mil por CPF por instituição. Você tem mais que isso lá.` });
  }
  if (cdi12m) {
    const below = list.filter((i) => i.rate_12m !== null && indexLabel(i) !== 'Renda variável' && (i.rate_12m as number) < cdi12m * 0.85);
    if (below.length) {
      out.push({ tone: 'info', title: `${below.length} investimento(s) rendendo bem abaixo do CDI`, text: `Nos últimos 12 meses renderam menos de 85% do CDI: ${below.slice(0, 3).map((i) => i.name).join(', ')}${below.length > 3 ? '...' : ''}.` });
    }
  }
  const rv = s.byIndex.find((x) => x.label === 'Renda variável');
  if (!rv && s.total > 0) {
    out.push({ tone: 'info', title: 'Carteira só de renda fixa', text: 'É mais estável. Se um dia quiser buscar mais retorno no longo prazo, ações e FIIs são o próximo degrau (com mais oscilação).' });
  }
  if (!out.length) out.push({ tone: 'ok', title: 'Nada chamando atenção', text: 'Não achei concentração exagerada nem aplicação muito abaixo do CDI.' });
  return out;
}

/** Soma os proventos (dividendos, JCP, rendimentos de FII) pagos nos últimos 12 meses. */
export function sumDividends12m(list: { date: string; value: number }[], today: Date = new Date()): number | null {
  if (!list.length) return null;
  const from = new Date(today.getTime() - 365 * 86400000).toISOString().slice(0, 10);
  const total = list.filter((d) => d.date >= from).reduce((s, d) => s + d.value, 0);
  return total > 0 ? total : null;
}
