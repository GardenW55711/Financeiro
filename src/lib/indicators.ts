// Leitura dos indicadores de uma ação ou FII: compara cada número com faixas
// de referência comuns no mercado. Não é recomendação, é um "semáforo" para estudar.

export type Verdict = 'bom' | 'neutro' | 'atencao' | 'semdado';
export type Reading = { key: string; name: string; value: string; verdict: Verdict; explain: string };

export type QuoteLike = {
  price: number | null;
  pl: number | null;
  pvp: number | null;
  dy: number | null;
  roe: number | null;
  netMargin: number | null;
  debtToEquity: number | null;
  evEbitda: number | null;
  lpa: number | null;
  vpa: number | null;
  dividends12m: number | null;
};

const pct = (v: number | null, d = 1) => (v === null || !Number.isFinite(v) ? '—' : `${v.toFixed(d).replace('.', ',')}%`);
const x = (v: number | null, d = 2) => (v === null || !Number.isFinite(v) ? '—' : v.toFixed(d).replace('.', ','));

function band(v: number | null, good: (v: number) => boolean, bad: (v: number) => boolean): Verdict {
  if (v === null || !Number.isFinite(v)) return 'semdado';
  if (good(v)) return 'bom';
  if (bad(v)) return 'atencao';
  return 'neutro';
}

export function readStock(q: QuoteLike): Reading[] {
  return [
    {
      key: 'pl', name: 'P/L', value: x(q.pl, 1),
      verdict: band(q.pl, (v) => v > 0 && v < 10, (v) => v <= 0 || v > 20),
      explain: q.pl !== null && q.pl <= 0
        ? 'P/L negativo quer dizer que a empresa teve prejuízo nos últimos 12 meses.'
        : `Seriam ${x(q.pl, 1)} anos de lucro para "pagar" o preço da ação. Abaixo de 10 costuma ser visto como barato; acima de 20, caro (varia por setor).`,
    },
    {
      key: 'pvp', name: 'P/VP', value: x(q.pvp),
      verdict: band(q.pvp, (v) => v > 0 && v < 1.5, (v) => v > 3 || v <= 0),
      explain: 'Preço comparado ao patrimônio da empresa. Abaixo de 1 você paga menos que o valor contábil; acima de 3 o mercado aposta alto no futuro.',
    },
    {
      key: 'dy', name: 'Dividend Yield (12m)', value: pct(q.dy),
      verdict: band(q.dy, (v) => v >= 6, (v) => v < 2),
      explain: 'Quanto a empresa devolveu em dividendos e JCP em 12 meses, em relação ao preço. Acima de 6% é o critério de Bazin.',
    },
    {
      key: 'roe', name: 'ROE', value: pct(q.roe),
      verdict: band(q.roe, (v) => v >= 15, (v) => v < 8),
      explain: 'Lucro gerado para cada R$ 100 dos sócios. Acima de 15% é considerado bom.',
    },
    {
      key: 'margem', name: 'Margem líquida', value: pct(q.netMargin),
      verdict: band(q.netMargin, (v) => v >= 10, (v) => v < 3),
      explain: 'De cada R$ 100 vendidos, quanto vira lucro. Compare com empresas do mesmo setor.',
    },
    {
      key: 'divida', name: 'Dívida / Patrimônio', value: q.debtToEquity === null ? '—' : `${x(q.debtToEquity)}x`,
      verdict: band(q.debtToEquity, (v) => v < 0.5, (v) => v > 1.5),
      explain: 'Quanto a empresa deve para cada R$ 1 de patrimônio. Muito endividada fica frágil quando os juros sobem.',
    },
    {
      key: 'evebitda', name: 'EV/EBITDA', value: x(q.evEbitda, 1),
      verdict: band(q.evEbitda, (v) => v > 0 && v < 6, (v) => v > 12 || v <= 0),
      explain: 'Como o P/L, mas inclui a dívida e olha a geração de caixa da operação. Abaixo de 6 costuma ser barato.',
    },
  ];
}

export function readFii(q: QuoteLike, cdi: number | null): Reading[] {
  return [
    {
      key: 'dy', name: 'Dividend Yield (12m)', value: pct(q.dy),
      verdict: band(q.dy, (v) => (cdi ? v >= cdi * 0.8 : v >= 9), (v) => v < 6),
      explain: `Rendimentos de 12 meses em relação ao preço da cota${cdi ? `. Para comparar: o CDI está em ${pct(cdi)} (mas o rendimento do FII é isento de IR)` : ''}. Muito acima dos outros fundos pode indicar algo que não se repete.`,
    },
    {
      key: 'pvp', name: 'P/VP', value: x(q.pvp),
      verdict: band(q.pvp, (v) => v >= 0.85 && v <= 1.05, (v) => v > 1.15 || v < 0.7),
      explain: 'Preço da cota comparado ao patrimônio do fundo. Entre 0,90 e 1,05 é a faixa considerada razoável. Bem abaixo de 1 pode ser oportunidade ou sinal de risco.',
    },
    {
      key: 'mensal', name: 'Rendimento médio por mês', value: q.dividends12m ? `R$ ${(q.dividends12m / 12).toFixed(2).replace('.', ',')}` : '—',
      verdict: q.dividends12m ? 'neutro' : 'semdado',
      explain: 'Média dos rendimentos pagos por cota em cada mês do último ano.',
    },
  ];
}

/** Itens que o app não consegue medir sozinho, para você conferir no relatório do fundo/empresa. */
export const STOCK_CHECKLIST = [
  'Lucro cresceu ou ficou estável nos últimos 5 anos?',
  'Dívida líquida/EBITDA abaixo de 2–3?',
  'Você entende como a empresa ganha dinheiro?',
  'O setor tem futuro (não está sendo substituído por tecnologia nova)?',
  'A empresa paga dividendos com regularidade?',
];

export const FII_CHECKLIST = [
  'Vacância abaixo de 10% (FII de tijolo)?',
  'Inquilinos variados, sem depender de um só?',
  'Liquidez diária acima de R$ 1 milhão?',
  'Rendimentos estáveis nos últimos 12–24 meses?',
  'Taxa de administração razoável e gestor com bom histórico?',
  'FII de papel: CRIs de devedores sólidos (high grade) e garantias boas?',
];
