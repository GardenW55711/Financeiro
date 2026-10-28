// Descobre o nome do banco de verdade (Itaú, Nubank, XP...).
// Pelo Meu Pluggy, a Pluggy diz que tudo vem do "MeuPluggy", que é só o intermediário.
// Analogia: é como receber várias cartas pelo mesmo carteiro; o nome do carteiro
// não diz quem mandou. Aqui a gente lê o "remetente" de cada conta.

type Bank = { name: string; codes: string[]; words: string[] };

// codes = número do banco (código COMPE, aquele de 3 dígitos do TED/PIX)
const BANKS: Bank[] = [
  { name: 'Itaú', codes: ['341', '184', '652'], words: ['itau', 'unibanco', 'iti'] },
  { name: 'Nubank', codes: ['260', '018'], words: ['nubank', 'nu pagamentos', 'nu financeira', 'nu invest', 'nuinvest', 'ultravioleta'] },
  { name: 'XP', codes: ['102', '348'], words: ['xp investimentos', 'xp inc', 'banco xp', 'xp '] },
  { name: 'Rico', codes: [], words: ['rico investimentos', 'rico corretora'] },
  { name: 'Clear', codes: [], words: ['clear corretora'] },
  { name: 'Inter', codes: ['077'], words: ['banco inter', 'inter&co', 'inter dtvm', 'intermedium'] },
  { name: 'Bradesco', codes: ['237', '394', '204'], words: ['bradesco', 'banco next'] },
  { name: 'Santander', codes: ['033'], words: ['santander'] },
  { name: 'Caixa', codes: ['104'], words: ['caixa economica', 'caixa'] },
  { name: 'Banco do Brasil', codes: ['001'], words: ['banco do brasil', 'bb dtvm', 'ourocard'] },
  { name: 'C6 Bank', codes: ['336'], words: ['c6 bank', 'banco c6', 'c6'] },
  { name: 'BTG Pactual', codes: ['208'], words: ['btg'] },
  { name: 'PicPay', codes: ['380'], words: ['picpay'] },
  { name: 'Mercado Pago', codes: ['323'], words: ['mercado pago', 'mercadopago'] },
  { name: 'PagBank', codes: ['290'], words: ['pagbank', 'pagseguro'] },
  { name: 'Sicoob', codes: ['756'], words: ['sicoob'] },
  { name: 'Sicredi', codes: ['748'], words: ['sicredi'] },
  { name: 'Banco Original', codes: ['212'], words: ['banco original'] },
  { name: 'Neon', codes: ['536', '655'], words: ['neon'] },
  { name: 'Safra', codes: ['422'], words: ['safra'] },
  { name: 'Banrisul', codes: ['041'], words: ['banrisul'] },
  { name: 'Will Bank', codes: [], words: ['will bank', 'willbank'] },
  { name: 'Mercantil', codes: ['389'], words: ['mercantil'] },
  { name: 'Ticket', codes: [], words: ['ticket'] },
];

function plain(s: string): string {
  return ` ${s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9&]+/g, ' ').trim()} `;
}

/** Procura o banco pelo código (ex.: "0341" ou "341"). */
export function bankFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = String(code).replace(/\D/g, '').replace(/^0+(?=\d{3})/, '').padStart(3, '0');
  return BANKS.find((b) => b.codes.includes(c))?.name ?? null;
}

/** Procura o banco por palavras no texto (ex.: "NU PAGAMENTOS S.A." → Nubank). */
export function bankFromText(...texts: (string | null | undefined)[]): string | null {
  const t = plain(texts.filter(Boolean).join(' '));
  if (t.trim() === '') return null;
  for (const b of BANKS) {
    for (const w of b.words) {
      if (t.includes(` ${plain(w).trim()} `)) return b.name;
    }
  }
  return null;
}

export function isAggregator(name: string | null | undefined): boolean {
  return !!name && /meu\s*pluggy/i.test(name);
}

/** Nome do banco de uma conta vinda da Pluggy. `fallback` é o nome do conector. */
export function bankOfAccount(a: any, fallback: string): string {
  // 1) número de transferência: "0341/1234/56789-0" → começa pelo código do banco
  const transfer: string | undefined = a?.bankData?.transferNumber;
  const fromTransfer = transfer ? bankFromCode(transfer.split(/[/\s-]/)[0]) : null;
  if (fromTransfer) return fromTransfer;
  // 2) campos de instituição, se vierem
  const inst = a?.institution ?? a?.bankData?.institution;
  const fromInst = bankFromCode(inst?.number ?? inst?.code) ?? bankFromText(inst?.name);
  if (fromInst) return fromInst;
  // 3) nome da conta/cartão (ex.: "Nubank Ultravioleta", "Itaú Personnalité")
  const fromName = bankFromText(a?.marketingName, a?.name);
  if (fromName) return fromName;
  if (!isAggregator(fallback)) return fallback;
  // Não achou: mostra o nome da própria conta, que é melhor que "MeuPluggy"
  return inst?.name || a?.marketingName || a?.name || 'Banco';
}

/**
 * Nome do banco/corretora onde o investimento está (a Pluggy manda institution.name,
 * às vezes com o nome jurídico). Não usa o "emissor": um CDB do banco X comprado na XP está na XP.
 */
export function bankOfInvestment(raw: any, fallback: string): string {
  const inst = raw?.institution;
  return bankFromCode(inst?.number)
    ?? bankFromText(inst?.name)
    ?? (isAggregator(fallback) ? inst?.name || 'Corretora' : fallback);
}
