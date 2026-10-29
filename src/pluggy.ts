// Conversa com a Pluggy (uso pessoal via Meu Pluggy).
// As chaves ficam no "cofre" do celular (SecureStore) e nunca no código.

import * as SecureStore from 'expo-secure-store';
import { applyTransferDetection, getItemIds, getSetting, replaceInvestments, setSetting, upsertAccount, upsertTransactions, TxBase } from './db';
import { Investment, mapInvestment } from './lib/investments';
import { bankOfAccount, bankOfInvestment } from './lib/banks';
import { digits } from './lib/transfers';
import { addDays, todayYmd } from './lib/dates';

const BASE = 'https://api.pluggy.ai';
const K_ID = 'pluggy_client_id';
const K_SECRET = 'pluggy_client_secret';

export async function saveCredentials(clientId: string, clientSecret: string | null): Promise<void> {
  await SecureStore.setItemAsync(K_ID, clientId.trim());
  if (clientSecret) await SecureStore.setItemAsync(K_SECRET, clientSecret.trim());
}

export async function getClientId(): Promise<string | null> {
  return SecureStore.getItemAsync(K_ID);
}

export async function hasSecret(): Promise<boolean> {
  return (await SecureStore.getItemAsync(K_SECRET)) !== null;
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(K_ID);
  await SecureStore.deleteItemAsync(K_SECRET);
}

class PluggyError extends Error {}

async function auth(): Promise<string> {
  const clientId = await SecureStore.getItemAsync(K_ID);
  const clientSecret = await SecureStore.getItemAsync(K_SECRET);
  if (!clientId || !clientSecret) throw new PluggyError('Cadastre o Client ID e o Client Secret nos Ajustes.');
  const res = await fetch(`${BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) {
    throw new PluggyError(res.status === 401 || res.status === 403
      ? 'A Pluggy recusou as chaves. Confira o Client ID e o Client Secret.'
      : `Erro ao entrar na Pluggy (${res.status}).`);
  }
  const data = await res.json();
  return data.apiKey as string;
}

async function get<T = any>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { 'X-API-KEY': apiKey } });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    const err = new PluggyError(`Pluggy respondeu ${res.status} em ${path.split('?')[0]}. ${txt.slice(0, 160)}`);
    (err as any).status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

function mapTx(t: any, accountId: string): TxBase {
  return {
    id: String(t.id),
    account_id: accountId,
    date: String(t.date).slice(0, 10),
    description: t.description || t.descriptionRaw || 'Sem descrição',
    amount: Number(t.amount) || 0,
    type: t.type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
    pluggy_category: t.category ?? null,
    installment_number: t.creditCardMetadata?.installmentNumber ?? null,
    total_installments: t.creditCardMetadata?.totalInstallments ?? null,
    source: 'pluggy',
    payer_doc: digits(t.paymentData?.payer?.documentNumber?.value),
    receiver_doc: digits(t.paymentData?.receiver?.documentNumber?.value),
    counterpart: (t.type === 'CREDIT' ? t.paymentData?.payer?.name : t.paymentData?.receiver?.name) ?? null,
    same_owner: sameOwner(t) ? 1 : 0,
  };
}

/** A própria transação mostra que quem pagou e quem recebeu têm o mesmo CPF? */
function sameOwner(t: any): boolean {
  const a = digits(t.paymentData?.payer?.documentNumber?.value);
  const b = digits(t.paymentData?.receiver?.documentNumber?.value);
  return !!a && a === b;
}

/** Busca todos os lançamentos de uma conta desde `from`, página por página. */
async function fetchTransactions(accountId: string, from: string, apiKey: string): Promise<TxBase[]> {
  const out: TxBase[] = [];
  try {
    let path: string | null = `/v2/transactions?accountId=${accountId}&dateFrom=${from}`;
    let guard = 0;
    while (path && guard < 50) {
      const data: { results: any[]; next: string | null } = await get(path, apiKey);
      (data.results || []).forEach((t) => out.push(mapTx(t, accountId)));
      const next: string | null = data.next;
      path = next ? `/v2/transactions${next.startsWith('?') ? next : `?${next}`}` : null;
      guard++;
    }
    return out;
  } catch (e: any) {
    if (e?.status !== 404) throw e;
  }
  // Plano B: rota antiga, paginada por número de página
  let page = 1;
  let totalPages = 1;
  do {
    const data: { results: any[]; totalPages: number } = await get(
      `/transactions?accountId=${accountId}&from=${from}&pageSize=500&page=${page}`, apiKey);
    (data.results || []).forEach((t) => out.push(mapTx(t, accountId)));
    totalPages = data.totalPages || 1;
    page++;
  } while (page <= totalPages && page < 50);
  return out;
}

/** Busca as aplicações de um banco. Devolve null se o banco não libera investimentos. */
async function fetchInvestments(itemId: string, bankName: string, apiKey: string): Promise<Investment[] | null> {
  const out: Investment[] = [];
  const now = new Date().toISOString();
  let page = 1;
  let totalPages = 1;
  try {
    do {
      const data: { results: any[]; totalPages: number } = await get(
        `/investments?itemId=${itemId}&pageSize=500&page=${page}`, apiKey);
      for (const raw of data.results || []) {
        const inv = mapInvestment(raw, itemId, bankOfInvestment(raw, bankName), now);
        if (inv) out.push(inv);
      }
      totalPages = data.totalPages || 1;
      page++;
    } while (page <= totalPages && page < 20);
  } catch (e: any) {
    // 400/403/404: esse banco (ou o Meu Pluggy) não entrega investimentos. Não é erro grave.
    if ([400, 403, 404].includes(e?.status)) return null;
    throw e;
  }
  return out;
}

export type SyncResult = { accounts: number; newTx: number; investments: number; transfers: number; warnings: string[] };

export async function syncAll(): Promise<SyncResult> {
  const itemIds = await getItemIds();
  if (!itemIds.length) throw new PluggyError('Adicione pelo menos um ID de banco conectado (item) nos Ajustes.');
  const apiKey = await auth();
  const last = await getSetting('last_sync_date');
  // Primeira vez: 6 meses para trás. Depois: desde 10 dias antes da última sincronização.
  // Na primeira sincronização desta versão, busca 6 meses de novo para pegar os dados de CPF
  // de quem pagou/recebeu (usados para reconhecer transferências entre suas contas).
  const refetched = await getSetting('refetch_transfer_data');
  const from = last && refetched ? addDays(last, -10) : addDays(todayYmd(), -180);
  const warnings: string[] = [];
  let accounts = 0;
  let newTx = 0;
  let investments = 0;

  for (const itemId of itemIds) {
    let bankName = 'Banco';
    try {
      const item = await get<any>(`/items/${itemId}`, apiKey);
      bankName = item?.connector?.name || bankName;
      const exp: string | undefined = item?.consentExpiresAt;
      if (exp) {
        const days = Math.round((new Date(exp).getTime() - Date.now()) / 86400000);
        if (days < 0) warnings.push(`${bankName}: a autorização venceu. Entre de novo no Meu Pluggy para renovar.`);
        else if (days < 20) warnings.push(`${bankName}: a autorização vence em ${days} dias.`);
      }
      if (item?.status === 'LOGIN_ERROR') warnings.push(`${bankName}: a conexão precisa ser refeita no Meu Pluggy.`);
    } catch (e: any) {
      if (e?.status === 404) {
        warnings.push(`O ID ${itemId.slice(0, 8)}… não foi encontrado na Pluggy. Confira nos Ajustes.`);
        continue;
      }
      throw e;
    }

    const accs = await get<{ results: any[] }>(`/accounts?itemId=${itemId}`, apiKey);
    for (const a of accs.results || []) {
      await upsertAccount({
        id: String(a.id),
        item_id: itemId,
        bank_name: bankOfAccount(a, bankName),
        type: a.type === 'CREDIT' ? 'CREDIT' : 'BANK',
        subtype: a.subtype ?? null,
        name: a.marketingName || a.name || 'Conta',
        number: a.number ?? null,
        balance: typeof a.balance === 'number' ? a.balance : null,
        credit_limit: a.creditData?.creditLimit ?? null,
        available_limit: a.creditData?.availableCreditLimit ?? null,
        close_date: a.creditData?.balanceCloseDate ? String(a.creditData.balanceCloseDate).slice(0, 10) : null,
        due_date: a.creditData?.balanceDueDate ? String(a.creditData.balanceDueDate).slice(0, 10) : null,
        updated_at: new Date().toISOString(),
      });
      accounts++;
      const txs = await fetchTransactions(String(a.id), from, apiKey);
      newTx += await upsertTransactions(txs);
    }

    try {
      const invs = await fetchInvestments(itemId, bankName, apiKey);
      if (invs) {
        await replaceInvestments(itemId, invs);
        investments += invs.length;
      }
    } catch (e: any) {
      warnings.push(`${bankName}: não deu para ler os investimentos agora (${String(e?.message ?? e).slice(0, 80)}).`);
    }
  }

  // Marca as transferências entre suas contas (não contam como gasto)
  let transfers = 0;
  try {
    transfers = await applyTransferDetection();
  } catch (e: any) {
    warnings.push(`Não deu para reconhecer as transferências entre contas agora (${String(e?.message ?? e).slice(0, 80)}).`);
  }

  await setSetting('refetch_transfer_data', '1');
  await setSetting('last_sync_date', todayYmd());
  await setSetting('last_sync_at', new Date().toISOString());
  await setSetting('last_sync_warnings', JSON.stringify(warnings));
  return { accounts, newTx, investments, transfers, warnings };
}
