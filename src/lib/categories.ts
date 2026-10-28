import { normalize, rulePattern } from './format';

export type Category = {
  id: string;
  name: string;
  color: string;
  /** 1 = não entra no gráfico de gastos (ex.: pagamento de fatura) */
  excluded: number;
  sort: number;
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'moradia', name: 'Moradia', color: '#0F4C5C', excluded: 0, sort: 1 },
  { id: 'alimentacao', name: 'Alimentação', color: '#D9731A', excluded: 0, sort: 2 },
  { id: 'contas', name: 'Contas da casa', color: '#3B6FB6', excluded: 0, sort: 3 },
  { id: 'transporte', name: 'Transporte', color: '#7A5AA6', excluded: 0, sort: 4 },
  { id: 'lazer', name: 'Lazer', color: '#C2477A', excluded: 0, sort: 5 },
  { id: 'saude', name: 'Saúde', color: '#2E8B57', excluded: 0, sort: 6 },
  { id: 'compras', name: 'Compras', color: '#8C6D1F', excluded: 0, sort: 7 },
  { id: 'estudos', name: 'Estudos', color: '#A0522D', excluded: 0, sort: 8 },
  { id: 'outros', name: 'Outros', color: '#8A8F98', excluded: 0, sort: 9 },
  { id: 'fatura', name: 'Pagamento de fatura', color: '#5B6070', excluded: 1, sort: 90 },
  { id: 'transferencia', name: 'Entre minhas contas', color: '#9AA0A6', excluded: 1, sort: 91 },
];

export const CATEGORY_COLORS = [
  '#0F4C5C', '#D9731A', '#3B6FB6', '#7A5AA6', '#C2477A', '#2E8B57', '#8C6D1F', '#A0522D', '#B45309', '#1F7A8C',
];

// Palavras (em inglês, como a Pluggy manda, e em português, como aparece no extrato)
const MAP: [string[], string][] = [
  [['credit card payment', 'pagamento de fatura', 'pagamento fatura', 'pagto fatura', 'pag fatura', 'pgto fatura'], 'fatura'],
  [['same person transfer', 'mesma titularidade'], 'transferencia'],
  [['rent', 'aluguel', 'housing', 'condominio', 'imobiliaria'], 'moradia'],
  [['groceries', 'supermarket', 'supermercado', 'mercado', 'food', 'eating out', 'restaurant', 'restaurante',
    'food delivery', 'ifood', 'padaria', 'bakery', 'lanchonete', 'acougue', 'hortifruti'], 'alimentacao'],
  [['electricity', 'energia', 'water', 'agua', 'utilities', 'telecommunications', 'internet', 'telefone',
    'celular', 'enel', 'light', 'claro', 'vivo', 'tim'], 'contas'],
  [['transport', 'uber', 'fuel', 'combustivel', 'posto', 'gas station', 'parking', 'estacionamento',
    'taxi', 'onibus', 'tolls', 'pedagio', 'automotive'], 'transporte'],
  [['leisure', 'entertainment', 'streaming', 'cinema', 'travel', 'viagem', 'lazer', 'games', 'netflix', 'spotify'], 'lazer'],
  [['health', 'saude', 'pharmacy', 'farmacia', 'drogaria', 'hospital', 'dentist', 'clinica', 'laboratorio'], 'saude'],
  [['shopping', 'clothing', 'electronics', 'eletronicos', 'loja'], 'compras'],
  [['education', 'educacao', 'curso', 'school', 'escola', 'faculdade', 'livraria', 'bookstore'], 'estudos'],
];

/** Palavra inteira; palavras longas (5+ letras) também valem como começo de palavra. */
function hasWord(text: string, kw: string): boolean {
  if (` ${text} `.includes(` ${kw} `)) return true;
  return kw.length >= 5 && ` ${text}`.includes(` ${kw}`);
}

/** Sugere uma categoria a partir da categoria da Pluggy e da descrição. */
export function guessCategory(pluggyCategory: string | null, description: string): string | null {
  const texts = [normalize(pluggyCategory ?? ''), normalize(description)];
  for (const [kws, id] of MAP) {
    for (const t of texts) {
      if (!t) continue;
      if (kws.some((kw) => hasWord(t, normalize(kw)))) return id;
    }
  }
  return null;
}

export type Rule = { id: number; pattern: string; category_id: string | null; tags: string };

/** A regra vale quando o texto da regra está contido na descrição (sem números/acentos). */
export function matchRule(rules: Rule[], description: string): Rule | null {
  const p = rulePattern(description);
  for (const r of rules) {
    if (r.pattern && p.includes(r.pattern)) return r;
  }
  return null;
}
