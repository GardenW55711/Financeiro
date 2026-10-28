// Regras dos investimentos (sem depender do celular, para poder testar).
// Analogia: a Pluggy entrega uma "caixa" com os dados de cada aplicação;
// aqui a gente escolhe o que mostrar e em que gaveta (tipo) cada uma vai.

export type Investment = {
  id: string;
  item_id: string;
  bank_name: string | null;
  name: string;
  type: string; // FIXED_INCOME, MUTUAL_FUND, EQUITY, ETF, SECURITY, COE, OTHER
  subtype: string | null;
  balance: number; // quanto vale hoje (bruto)
  profit: number | null; // quanto rendeu, se o banco informar
  due_date: string | null; // vencimento (renda fixa)
  rate: string | null; // ex.: "100% CDI" ou "12,5% a.a."
  updated_at: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  FIXED_INCOME: 'Renda fixa',
  MUTUAL_FUND: 'Fundos',
  EQUITY: 'Ações',
  ETF: 'ETFs',
  SECURITY: 'Previdência e títulos',
  COE: 'COE',
  OTHER: 'Outros',
};

const SUBTYPE_LABEL: Record<string, string> = {
  CDB: 'CDB', LCI: 'LCI', LCA: 'LCA', LC: 'LC', TREASURY: 'Tesouro Direto', DEBENTURES: 'Debênture',
  CRI: 'CRI', CRA: 'CRA', RETIREMENT: 'Previdência', MULTIMARKET_FUND: 'Fundo multimercado',
  FIXED_INCOME_FUND: 'Fundo de renda fixa', STOCK_FUND: 'Fundo de ações', REAL_ESTATE_FUND: 'Fundo imobiliário',
  STOCK: 'Ação', BDR: 'BDR', DERIVATIVES: 'Derivativos',
};

export function typeLabel(type: string): string {
  return TYPE_LABEL[type] ?? 'Outros';
}

export function subtypeLabel(subtype: string | null): string | null {
  return subtype ? SUBTYPE_LABEL[subtype] ?? null : null;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Converte o que a Pluggy manda em um investimento nosso. Devolve null se não estiver ativo. */
export function mapInvestment(raw: any, itemId: string, bankName: string, now: string): Investment | null {
  if (raw?.status && raw.status !== 'ACTIVE') return null;
  // O "valor de hoje" pode vir em campos diferentes, conforme o banco.
  const balance = num(raw?.balance)
    ?? num(raw?.amount)
    ?? (num(raw?.value) !== null && num(raw?.quantity) !== null ? (raw.value as number) * (raw.quantity as number) : null)
    ?? 0;
  let rate: string | null = null;
  const r = num(raw?.rate);
  if (r !== null && raw?.rateType) rate = `${fmt(r)}% ${raw.rateType === 'CDI' ? 'do CDI' : raw.rateType}`;
  else if (num(raw?.fixedAnnualRate) !== null) rate = `${fmt(raw.fixedAnnualRate)}% ao ano`;
  return {
    id: String(raw.id),
    item_id: itemId,
    bank_name: bankName,
    name: raw?.name || subtypeLabel(raw?.subtype ?? null) || typeLabel(raw?.type ?? 'OTHER'),
    type: TYPE_LABEL[raw?.type] ? raw.type : 'OTHER',
    subtype: raw?.subtype ?? null,
    balance,
    profit: num(raw?.amountProfit),
    due_date: raw?.dueDate ? String(raw.dueDate).slice(0, 10) : null,
    rate,
    updated_at: now,
  };
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

export type InvestmentGroup = { type: string; label: string; total: number; items: Investment[] };

/** Junta por tipo (Renda fixa, Fundos...), do maior para o menor. */
export function groupInvestments(list: Investment[]): InvestmentGroup[] {
  const map = new Map<string, InvestmentGroup>();
  for (const i of list) {
    const g = map.get(i.type) ?? { type: i.type, label: typeLabel(i.type), total: 0, items: [] };
    g.total += i.balance;
    g.items.push(i);
    map.set(i.type, g);
  }
  const groups = Array.from(map.values());
  groups.forEach((g) => g.items.sort((a, b) => b.balance - a.balance));
  return groups.sort((a, b) => b.total - a.total);
}
