// Reconhece transferências entre as SUAS contas, para não contarem como gasto (nem como entrada).
// Analogia: tirar dinheiro do bolso da calça e colocar no bolso da jaqueta não é gastar.
// O dinheiro só "sai" de verdade quando vai para outra pessoa ou para pagar alguma coisa.

import { normalize } from './format';
import { diffDays } from './dates';

export type TxForTransfer = {
  id: string;
  account_id: string | null;
  date: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  pluggy_category: string | null;
  payer_doc: string | null; // CPF/CNPJ de quem pagou (só números)
  receiver_doc: string | null; // CPF/CNPJ de quem recebeu
  same_owner: number | null; // 1 = a Pluggy disse que é a mesma pessoa
};

export type TransferReason = 'pluggy' | 'cpf' | 'par' | 'nome' | 'aplicacao';

export const REASON_TEXT: Record<TransferReason, string> = {
  pluggy: 'o banco marcou como transferência para a mesma titularidade',
  cpf: 'o dinheiro foi para (ou veio de) uma conta no seu CPF',
  par: 'saiu de uma conta sua e entrou em outra conta sua, com o mesmo valor',
  nome: 'a descrição tem o seu nome',
  aplicacao: 'é aplicação ou resgate de investimento/caixinha',
};

export type TransferOptions = {
  ownAccountIds: Set<string>; // contas correntes/poupança que são suas (vindas da Pluggy)
  ownDocs: Set<string>; // seus CPFs (só números)
  ownNames: string[]; // seu nome como aparece no extrato (ex.: "eder almeida")
  pairDays?: number; // diferença máxima de dias entre a saída e a entrada (padrão 3)
};

export function digits(s: string | null | undefined): string | null {
  const d = (s ?? '').replace(/\D/g, '');
  return d.length >= 11 ? d : null;
}

/** Palavras que indicam transferência (Pix, TED...), para não confundir com compra numa loja com seu sobrenome. */
const TRANSFER_WORDS = ['pix', 'ted', 'doc', 'transf', 'transferencia', 'transferido', 'enviado', 'enviada', 'recebido', 'recebida'];

/** Movimentos para investimento/caixinha seus (o dinheiro continua sendo seu). */
const SAVINGS_WORDS = [
  'aplicacao', 'resgate', 'caixinha', 'cofrinho', 'porquinho', 'guardado', 'guardar dinheiro',
  'dinheiro guardado', 'rdb', 'meu porquinho', 'investimento automatico', 'aplicacao automatica', 'resgate automatico',
];

function hasAny(text: string, words: string[]): boolean {
  const t = ` ${text} `;
  return words.some((w) => t.includes(` ${w} `) || (w.length >= 5 && t.includes(` ${w}`)));
}

/** Seu nome aparece na descrição? Precisa de pelo menos 2 palavras do nome (ex.: "eder" e "almeida"). */
export function mentionsName(description: string, names: string[]): boolean {
  const t = ` ${normalize(description)} `;
  for (const n of names) {
    const parts = normalize(n).split(' ').filter((p) => p.length >= 3);
    if (!parts.length) continue;
    const need = Math.min(2, parts.length);
    const found = parts.filter((p) => t.includes(` ${p} `)).length;
    if (found >= need) return true;
  }
  return false;
}

/**
 * Devolve quais lançamentos são transferência entre suas contas, com o motivo.
 * Não olha a categoria escolhida por você: quem decide se aplica é quem chama (respeitando suas escolhas).
 */
export function detectTransfers(txs: TxForTransfer[], o: TransferOptions): Map<string, TransferReason> {
  const out = new Map<string, TransferReason>();
  const maxDays = o.pairDays ?? 3;

  for (const t of txs) {
    const desc = normalize(t.description || '');
    const cat = normalize(t.pluggy_category ?? '');
    // 1) O banco/Pluggy já diz que é mesma titularidade
    if (t.same_owner === 1 || cat.includes('same person') || desc.includes('mesma titularidade') || desc.includes('mesmo titular')) {
      out.set(t.id, 'pluggy');
      continue;
    }
    // 2) O CPF do outro lado é o seu
    const other = t.type === 'DEBIT' ? digits(t.receiver_doc) : digits(t.payer_doc);
    if (other && o.ownDocs.has(other)) {
      out.set(t.id, 'cpf');
      continue;
    }
    // 3) Aplicação ou resgate de investimento/caixinha
    if (hasAny(desc, SAVINGS_WORDS) && !hasAny(desc, ['compra', 'pagamento de boleto'])) {
      out.set(t.id, 'aplicacao');
      continue;
    }
    // 4) Seu nome na descrição de um Pix/TED
    if (o.ownNames.length && hasAny(desc, TRANSFER_WORDS) && mentionsName(t.description || '', o.ownNames)) {
      out.set(t.id, 'nome');
    }
  }

  // 5) Par: saiu de uma conta sua e entrou em outra conta sua, mesmo valor, até `maxDays` dias
  const own = (t: TxForTransfer) => !!t.account_id && o.ownAccountIds.has(t.account_id);
  const debits = txs.filter((t) => t.type === 'DEBIT' && own(t) && !out.has(t.id));
  const credits = txs.filter((t) => t.type === 'CREDIT' && own(t));
  const used = new Set<string>();
  // Créditos que já foram marcados por outro motivo podem formar par (ex.: o Pix enviado tinha seu nome)
  for (const d of debits.sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const value = Math.abs(d.amount);
    if (value < 1) continue;
    const dLooks = hasAny(normalize(d.description || ''), TRANSFER_WORDS);
    let best: TxForTransfer | null = null;
    let bestGap = Infinity;
    for (const c of credits) {
      if (used.has(c.id) || c.account_id === d.account_id) continue;
      if (Math.abs(Math.abs(c.amount) - value) > 0.009) continue;
      const gap = Math.abs(diffDays(d.date, c.date));
      if (gap > maxDays) continue;
      // Pelo menos um dos lados precisa ter cara de transferência (Pix, TED...)
      if (!dLooks && !hasAny(normalize(c.description || ''), TRANSFER_WORDS)) continue;
      if (gap < bestGap) { best = c; bestGap = gap; }
    }
    if (best) {
      used.add(best.id);
      out.set(d.id, 'par');
      if (!out.has(best.id)) out.set(best.id, 'par');
    }
  }
  // Se uma saída foi marcada (ex.: por nome/CPF), a entrada correspondente na outra conta também é transferência
  for (const [id, reason] of Array.from(out.entries())) {
    const d = txs.find((t) => t.id === id);
    if (!d || d.type !== 'DEBIT' || reason === 'aplicacao') continue;
    const c = credits.find((x) => !used.has(x.id) && !out.has(x.id) && x.account_id !== d.account_id
      && Math.abs(Math.abs(x.amount) - Math.abs(d.amount)) <= 0.009 && Math.abs(diffDays(d.date, x.date)) <= maxDays);
    if (c) { used.add(c.id); out.set(c.id, 'par'); }
  }
  return out;
}

/** Descobre seus CPFs: o documento que mais aparece como "quem pagou" nas suas saídas. */
export function guessOwnDocs(txs: Pick<TxForTransfer, 'type' | 'payer_doc' | 'receiver_doc'>[]): string[] {
  const count = new Map<string, number>();
  for (const t of txs) {
    const d = t.type === 'DEBIT' ? digits(t.payer_doc) : digits(t.receiver_doc);
    if (d && d.length === 11) count.set(d, (count.get(d) || 0) + 1);
  }
  const sorted = Array.from(count.entries()).sort((a, b) => b[1] - a[1]);
  if (!sorted.length || sorted[0][1] < 3) return [];
  return [sorted[0][0]];
}
