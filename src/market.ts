// Dados de mercado: taxas do Banco Central (grátis, sem cadastro) e
// cotações/indicadores de ações e FIIs pela brapi (precisa de uma chave grátis).
// Analogia: o Banco Central é o "termômetro" da economia (CDI, Selic, inflação);
// a brapi é o "jornal da bolsa" (preço e números de cada empresa).

import * as SecureStore from 'expo-secure-store';
import { getMarketCache, getSetting, setMarketCache, setSetting } from './db';
import { sumDividends12m } from './lib/portfolio';

// ---------- Banco Central (SGS) ----------

export type Rates = {
  cdi: number | null; // CDI ao ano, em %
  selic: number | null; // meta da Selic ao ano, em %
  ipca12m: number | null; // inflação dos últimos 12 meses, em %
  updatedAt: string | null;
};

async function bcbLast(series: number): Promise<number | null> {
  const res = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${series}/dados/ultimos/1?formato=json`);
  if (!res.ok) return null;
  const data = await res.json();
  const v = Number(String(data?.[0]?.valor ?? '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

/** CDI (série 4389), Selic meta (432) e IPCA 12 meses (13522). Guarda por 12 horas. */
export async function getRates(force = false): Promise<Rates> {
  const raw = await getSetting('bcb_rates');
  let cached: Rates | null = null;
  try { cached = raw ? JSON.parse(raw) : null; } catch { cached = null; }
  const fresh = cached?.updatedAt && Date.now() - new Date(cached.updatedAt).getTime() < 12 * 3600 * 1000;
  if (cached && fresh && !force) return cached;
  try {
    const [cdi, selic, ipca12m] = await Promise.all([bcbLast(4389), bcbLast(432), bcbLast(13522)]);
    const r: Rates = { cdi, selic, ipca12m, updatedAt: new Date().toISOString() };
    if (cdi !== null || selic !== null || ipca12m !== null) await setSetting('bcb_rates', JSON.stringify(r));
    return r;
  } catch {
    return cached ?? { cdi: null, selic: null, ipca12m: null, updatedAt: null };
  }
}

// ---------- brapi (ações e FIIs) ----------

const K_BRAPI = 'brapi_token';

export async function getBrapiToken(): Promise<string | null> {
  return SecureStore.getItemAsync(K_BRAPI);
}

export async function setBrapiToken(token: string | null): Promise<void> {
  if (token && token.trim()) await SecureStore.setItemAsync(K_BRAPI, token.trim());
  else await SecureStore.deleteItemAsync(K_BRAPI);
}

export type Quote = {
  symbol: string;
  name: string | null;
  price: number | null;
  changePct: number | null; // variação do dia, em %
  low52: number | null;
  high52: number | null;
  pl: number | null; // preço / lucro
  pvp: number | null; // preço / valor patrimonial
  dy: number | null; // dividend yield 12 meses, em %
  lpa: number | null; // lucro por ação
  vpa: number | null; // valor patrimonial por ação
  roe: number | null; // retorno sobre o patrimônio, em %
  netMargin: number | null; // margem líquida, em %
  debtToEquity: number | null; // dívida / patrimônio (vezes)
  evEbitda: number | null;
  dividends12m: number | null; // R$ pagos por ação/cota nos últimos 12 meses
  lastDividends: { date: string; value: number }[];
  marketCap: number | null;
  fetchedAt: string;
  partial: boolean; // true se alguns números não vieram (plano grátis ou ativo sem dados)
};

function n(v: unknown): number | null {
  const x = typeof v === 'string' ? Number(v) : v;
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
}
/** Converte fração em % (0,08 → 8). Se já vier em %, mantém. */
function asPct(v: unknown): number | null {
  const x = n(v);
  if (x === null) return null;
  return Math.abs(x) <= 1.5 ? x * 100 : x;
}

/** Dívida/patrimônio às vezes vem em % (85 = 0,85 vez). Padroniza para "vezes". */
function debtRatio(v: unknown): number | null {
  const x = n(v);
  if (x === null) return null;
  return x > 10 ? x / 100 : x;
}

async function brapiGet(path: string, token: string): Promise<any | null> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://brapi.dev${path}${sep}token=${encodeURIComponent(token)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => '');
    // Plano grátis pode não liberar alguns dados: segue sem eles
    if (/plan|plano|upgrade|not available|não disponível/i.test(body)) return null;
    throw new Error('A brapi recusou a chave. Confira o token em Ajustes.');
  }
  if (res.status === 429) throw new Error('Limite de consultas da brapi atingido por agora. Tente mais tarde.');
  if (!res.ok) return null;
  return res.json();
}

/** Busca cotação e indicadores de um ativo. Usa o que estiver guardado há menos de `maxAgeMin` minutos. */
export async function getQuote(symbol: string, opts: { maxAgeMin?: number; force?: boolean } = {}): Promise<Quote | null> {
  const sym = symbol.trim().toUpperCase();
  const maxAge = (opts.maxAgeMin ?? 30) * 60 * 1000;
  const cache = await getMarketCache(sym);
  if (cache && !opts.force && Date.now() - new Date(cache.fetched_at).getTime() < maxAge) {
    try { return JSON.parse(cache.json) as Quote; } catch { /* busca de novo */ }
  }
  const token = await getBrapiToken();
  if (!token) return cache ? (JSON.parse(cache.json) as Quote) : null;

  const q = await brapiGet(`/api/quote/${encodeURIComponent(sym)}?dividends=true&fundamental=true`, token);
  const r = q?.results?.[0];
  if (!r) {
    if (cache) return JSON.parse(cache.json) as Quote;
    throw new Error(`Não encontrei ${sym} na brapi. Confira o código.`);
  }
  // Indicadores extras (podem não estar no plano grátis)
  const [st, fd] = await Promise.all([
    brapiGet(`/api/v2/stocks/statistics?symbols=${encodeURIComponent(sym)}`, token).catch(() => null),
    brapiGet(`/api/v2/stocks/financial-data?symbols=${encodeURIComponent(sym)}`, token).catch(() => null),
  ]);
  const s = st?.results?.[0]?.data ?? {};
  const f = fd?.results?.[0]?.data ?? {};

  const divs: { date: string; value: number }[] = (r?.dividendsData?.cashDividends ?? [])
    .map((d: any) => ({ date: String(d.paymentDate ?? d.lastDatePrior ?? '').slice(0, 10), value: n(d.rate) ?? 0 }))
    .filter((d: { date: string; value: number }) => d.date && d.value > 0)
    .sort((a: { date: string }, b: { date: string }) => (a.date < b.date ? 1 : -1));
  const price = n(r.regularMarketPrice);
  const dividends12m = sumDividends12m(divs);
  const dyFromDivs = dividends12m && price ? (dividends12m / price) * 100 : null;
  const lpa = n(s.earningsPerShare) ?? n(s.trailingEps) ?? n(r.earningsPerShare);
  const vpa = n(s.bookValue);

  const quote: Quote = {
    symbol: sym,
    name: r.longName ?? r.shortName ?? null,
    price,
    changePct: n(r.regularMarketChangePercent),
    low52: n(r.fiftyTwoWeekLow),
    high52: n(r.fiftyTwoWeekHigh),
    pl: n(s.trailingPE) ?? n(r.priceEarnings),
    pvp: n(s.priceToBook) ?? (vpa && price ? price / vpa : null),
    dy: dyFromDivs ?? asPct(s.dividendYield),
    lpa,
    vpa,
    roe: asPct(f.returnOnEquity),
    netMargin: asPct(f.profitMargins ?? s.profitMargins),
    debtToEquity: debtRatio(f.debtToEquity),
    evEbitda: n(s.enterpriseToEbitda),
    dividends12m,
    lastDividends: divs.slice(0, 12),
    marketCap: n(r.marketCap ?? s.marketCap),
    fetchedAt: new Date().toISOString(),
    partial: false,
  };
  quote.partial = [quote.pl, quote.pvp, quote.dy, quote.roe].some((x) => x === null);
  await setMarketCache(sym, JSON.stringify(quote));
  return quote;
}
