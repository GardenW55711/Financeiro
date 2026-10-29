// Banco de dados local (SQLite) — fica só no celular.
// Analogia: é um caderno guardado na gaveta do próprio aparelho.

import * as SQLite from 'expo-sqlite';
import { Category, DEFAULT_CATEGORIES, guessCategory, matchRule, Rule } from './lib/categories';
import { Bill, BillManual } from './lib/bills';
import { DEFAULT_PAY_SETTINGS, PaySettings } from './lib/paydays';
import { rulePattern } from './lib/format';
import { Investment } from './lib/investments';
import { detectTransfers, guessOwnDocs, TransferReason } from './lib/transfers';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = init();
  return dbPromise;
}

async function init(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('financas.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT);
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL,
      excluded INTEGER NOT NULL DEFAULT 0, sort INTEGER NOT NULL DEFAULT 50
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY NOT NULL, item_id TEXT, bank_name TEXT, type TEXT, subtype TEXT,
      name TEXT, number TEXT, balance REAL, credit_limit REAL, available_limit REAL,
      close_date TEXT, due_date TEXT, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL, account_id TEXT, date TEXT NOT NULL, description TEXT,
      amount REAL NOT NULL, type TEXT NOT NULL, pluggy_category TEXT,
      installment_number INTEGER, total_installments INTEGER, source TEXT NOT NULL DEFAULT 'pluggy'
    );
    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
    CREATE TABLE IF NOT EXISTS tx_meta (
      tx_id TEXT PRIMARY KEY NOT NULL, category_id TEXT, tags TEXT NOT NULL DEFAULT '[]',
      note TEXT, display_name TEXT, cycle_override TEXT
    );
    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT, pattern TEXT NOT NULL, category_id TEXT, tags TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category_id TEXT,
      amount REAL NOT NULL DEFAULT 0, variable INTEGER NOT NULL DEFAULT 0, due_day INTEGER NOT NULL,
      cycle TEXT NOT NULL, keyword TEXT NOT NULL DEFAULT '', account_id TEXT, active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS investments (
      id TEXT PRIMARY KEY NOT NULL, item_id TEXT NOT NULL, bank_name TEXT, name TEXT NOT NULL, type TEXT NOT NULL,
      subtype TEXT, balance REAL NOT NULL DEFAULT 0, profit REAL, due_date TEXT, rate TEXT, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS account_alias (account_id TEXT PRIMARY KEY NOT NULL, bank_name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bill_manual (
      bill_id INTEGER NOT NULL, ym TEXT NOT NULL, paid INTEGER NOT NULL, PRIMARY KEY (bill_id, ym)
    );
  `);
  // Colunas novas dos investimentos (para quem já tinha o app instalado)
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(investments)');
  const have = new Set(cols.map((c) => c.name));
  const extra: [string, string][] = [
    ['code', 'TEXT'], ['quantity', 'REAL'], ['invested', 'REAL'], ['rate_12m', 'REAL'], ['rate_month', 'REAL'],
    ['purchase_date', 'TEXT'], ['issuer', 'TEXT'], ['index_type', 'TEXT'], ['source', "TEXT NOT NULL DEFAULT 'pluggy'"],
  ];
  for (const [c, t] of extra) if (!have.has(c)) await db.execAsync(`ALTER TABLE investments ADD COLUMN ${c} ${t}`);
  // Colunas para reconhecer transferências entre suas contas
  const txCols = new Set((await db.getAllAsync<{ name: string }>('PRAGMA table_info(transactions)')).map((c) => c.name));
  for (const [c, t] of [['payer_doc', 'TEXT'], ['receiver_doc', 'TEXT'], ['counterpart', 'TEXT'], ['same_owner', 'INTEGER']] as const) {
    if (!txCols.has(c)) await db.execAsync(`ALTER TABLE transactions ADD COLUMN ${c} ${t}`);
  }
  const metaCols = new Set((await db.getAllAsync<{ name: string }>('PRAGMA table_info(tx_meta)')).map((c) => c.name));
  // manual_cat = 1 quando VOCÊ escolheu a categoria (o app não troca mais sozinho)
  // transfer_reason = por que o app achou que é transferência entre suas contas
  for (const [c, t] of [['manual_cat', 'INTEGER NOT NULL DEFAULT 0'], ['transfer_reason', 'TEXT']] as const) {
    if (!metaCols.has(c)) await db.execAsync(`ALTER TABLE tx_meta ADD COLUMN ${c} ${t}`);
  }
  await db.runAsync(
    `INSERT OR IGNORE INTO categories (id, name, color, excluded, sort) VALUES ('transferencia', 'Entre minhas contas', '#9AA0A6', 1, 91)`,
  );
  await db.execAsync('CREATE TABLE IF NOT EXISTS market_cache (symbol TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL, fetched_at TEXT NOT NULL)');

  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
  if (!row || row.n === 0) {
    for (const c of DEFAULT_CATEGORIES) {
      await db.runAsync('INSERT INTO categories (id, name, color, excluded, sort) VALUES (?, ?, ?, ?, ?)', [
        c.id, c.name, c.color, c.excluded, c.sort,
      ]);
    }
  }
  return db;
}

// ---------- Configurações ----------

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM settings WHERE key = ?', [key]);
  return r?.value ?? null;
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

export async function getPaySettings(): Promise<PaySettings> {
  const raw = await getSetting('pay_settings');
  if (!raw) return DEFAULT_PAY_SETTINGS;
  try {
    return { ...DEFAULT_PAY_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PAY_SETTINGS;
  }
}

export async function setPaySettings(s: PaySettings): Promise<void> {
  await setSetting('pay_settings', JSON.stringify(s));
}

export async function getItemIds(): Promise<string[]> {
  const raw = await getSetting('pluggy_items');
  try {
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function setItemIds(ids: string[]): Promise<void> {
  await setSetting('pluggy_items', JSON.stringify(ids));
}

// ---------- Categorias ----------

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.getAllAsync<Category>('SELECT * FROM categories ORDER BY sort, name');
}

export async function addCategory(name: string, color: string): Promise<void> {
  const db = await getDb();
  const id = `c_${Date.now().toString(36)}`;
  await db.runAsync('INSERT INTO categories (id, name, color, excluded, sort) VALUES (?, ?, ?, 0, 50)', [id, name, color]);
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
  await db.runAsync('UPDATE tx_meta SET category_id = NULL WHERE category_id = ?', [id]);
}

// ---------- Contas bancárias / cartões ----------

export type Account = {
  id: string;
  item_id: string | null;
  bank_name: string | null;
  type: string; // BANK | CREDIT | MANUAL
  subtype: string | null;
  name: string;
  number: string | null;
  balance: number | null;
  credit_limit: number | null;
  available_limit: number | null;
  close_date: string | null;
  due_date: string | null;
  updated_at: string | null;
  custom_bank_name?: string | null; // nome que você escolheu (só na leitura)
};

export async function upsertAccount(a: Account): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO accounts (id, item_id, bank_name, type, subtype, name, number, balance, credit_limit,
      available_limit, close_date, due_date, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [a.id, a.item_id, a.bank_name, a.type, a.subtype, a.name, a.number, a.balance, a.credit_limit,
      a.available_limit, a.close_date, a.due_date, a.updated_at],
  );
}

export async function listAccounts(): Promise<Account[]> {
  const db = await getDb();
  return db.getAllAsync<Account>(
    `SELECT a.id, a.item_id, COALESCE(al.bank_name, a.bank_name) AS bank_name, a.type, a.subtype, a.name, a.number,
       a.balance, a.credit_limit, a.available_limit, a.close_date, a.due_date, a.updated_at,
       al.bank_name AS custom_bank_name
     FROM accounts a LEFT JOIN account_alias al ON al.account_id = a.id
     ORDER BY a.type, COALESCE(al.bank_name, a.bank_name), a.name`,
  );
}

/** Nome do banco escolhido por você para uma conta. null = volta para o automático. */
export async function setAccountBankName(accountId: string, name: string | null): Promise<void> {
  const db = await getDb();
  const v = name?.trim();
  if (!v) await db.runAsync('DELETE FROM account_alias WHERE account_id = ?', [accountId]);
  else await db.runAsync('INSERT OR REPLACE INTO account_alias (account_id, bank_name) VALUES (?, ?)', [accountId, v]);
}

export function accountLabel(a: Pick<Account, 'type' | 'name' | 'number' | 'bank_name'> & { subtype?: string | null }): string {
  const tail = a.number ? ` ••${a.number.replace(/\D/g, '').slice(-4)}` : '';
  if (a.type === 'CREDIT') return `Crédito${tail}`;
  if (a.type === 'MANUAL') return 'Manual';
  if (a.subtype === 'SAVINGS_ACCOUNT') return `Poupança${tail}`;
  return `Conta${tail}`;
}

// ---------- Investimentos ----------

/** Troca os investimentos de um banco pela lista nova (o que foi resgatado some). */
export async function replaceInvestments(itemId: string, list: Investment[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM investments WHERE item_id = ?', [itemId]);
    for (const i of list) await insertInvestment(db, i);
  });
}

async function insertInvestment(db: SQLite.SQLiteDatabase, i: Investment): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO investments (id, item_id, bank_name, name, type, subtype, balance, profit, due_date, rate, updated_at,
      code, quantity, invested, rate_12m, rate_month, purchase_date, issuer, index_type, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [i.id, i.item_id, i.bank_name, i.name, i.type, i.subtype, i.balance, i.profit, i.due_date, i.rate, i.updated_at,
      i.code, i.quantity, i.invested, i.rate_12m, i.rate_month, i.purchase_date, i.issuer, i.index_type, i.source],
  );
}

/** Investimento lançado à mão (fica guardado mesmo depois de sincronizar). */
export async function saveManualInvestment(i: Investment): Promise<void> {
  const db = await getDb();
  await insertInvestment(db, { ...i, item_id: 'manual', source: 'manual' });
}

export async function deleteInvestment(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM investments WHERE id = ?', [id]);
}

export async function getInvestment(id: string): Promise<Investment | null> {
  const db = await getDb();
  return db.getFirstAsync<Investment>('SELECT * FROM investments WHERE id = ?', [id]);
}

// ---------- Cache de cotações (para não consultar a toda hora) ----------

export async function getMarketCache(symbol: string): Promise<{ json: string; fetched_at: string } | null> {
  const db = await getDb();
  return db.getFirstAsync<{ json: string; fetched_at: string }>('SELECT json, fetched_at FROM market_cache WHERE symbol = ?', [symbol]);
}

export async function setMarketCache(symbol: string, json: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO market_cache (symbol, json, fetched_at) VALUES (?, ?, ?)', [symbol, json, new Date().toISOString()]);
}

export async function listInvestments(): Promise<Investment[]> {
  const db = await getDb();
  return db.getAllAsync<Investment>('SELECT * FROM investments ORDER BY balance DESC');
}

// ---------- Lançamentos ----------

export type Tx = {
  id: string;
  account_id: string | null;
  date: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  pluggy_category: string | null;
  installment_number: number | null;
  total_installments: number | null;
  source: 'pluggy' | 'manual';
  category_id: string | null;
  tags: string; // JSON
  note: string | null;
  display_name: string | null;
  cycle_override: string | null;
  payer_doc?: string | null;
  receiver_doc?: string | null;
  counterpart?: string | null;
  same_owner?: number | null;
  manual_cat?: number;
  transfer_reason?: string | null;
};

export type TxBase = Pick<Tx, 'id' | 'account_id' | 'date' | 'description' | 'amount' | 'type' | 'pluggy_category' |
  'installment_number' | 'total_installments' | 'source' | 'payer_doc' | 'receiver_doc' | 'counterpart' | 'same_owner'>;

export function parseTags(json: string | null | undefined): string[] {
  try {
    const v = JSON.parse(json || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Grava os lançamentos vindos do banco. Os novos já recebem categoria por regra ou sugestão. */
export async function upsertTransactions(list: TxBase[]): Promise<number> {
  if (!list.length) return 0;
  const db = await getDb();
  const rules = await listRules();
  let created = 0;
  await db.withTransactionAsync(async () => {
    for (const t of list) {
      await db.runAsync(
        `INSERT OR REPLACE INTO transactions (id, account_id, date, description, amount, type, pluggy_category,
          installment_number, total_installments, source, payer_doc, receiver_doc, counterpart, same_owner)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.id, t.account_id, t.date, t.description, t.amount, t.type, t.pluggy_category,
          t.installment_number, t.total_installments, t.source, t.payer_doc ?? null, t.receiver_doc ?? null,
          t.counterpart ?? null, t.same_owner ?? null],
      );
      const meta = await db.getFirstAsync<{ tx_id: string }>('SELECT tx_id FROM tx_meta WHERE tx_id = ?', [t.id]);
      if (!meta) {
        created++;
        const rule = matchRule(rules, t.description);
        const cat = rule?.category_id ?? (t.type === 'DEBIT' ? guessCategory(t.pluggy_category, t.description) : null);
        await db.runAsync('INSERT INTO tx_meta (tx_id, category_id, tags, manual_cat) VALUES (?, ?, ?, ?)', [t.id, cat, rule?.tags ?? '[]', rule ? 1 : 0]);
      }
    }
  });
  return created;
}

export type TxFilter = { from: string; to: string; accountId?: string };

export async function listTransactions(f: TxFilter): Promise<Tx[]> {
  const db = await getDb();
  const params: (string | number)[] = [f.from, f.to];
  let where = 't.date >= ? AND t.date <= ?';
  if (f.accountId) {
    where += ' AND t.account_id = ?';
    params.push(f.accountId);
  }
  return db.getAllAsync<Tx>(
    `SELECT t.*, m.category_id, COALESCE(m.tags, '[]') AS tags, m.note, m.display_name, m.cycle_override,
       COALESCE(m.manual_cat, 0) AS manual_cat, m.transfer_reason
     FROM transactions t LEFT JOIN tx_meta m ON m.tx_id = t.id
     WHERE ${where} ORDER BY t.date DESC, t.id`,
    params,
  );
}

export async function getTransaction(id: string): Promise<Tx | null> {
  const db = await getDb();
  return db.getFirstAsync<Tx>(
    `SELECT t.*, m.category_id, COALESCE(m.tags, '[]') AS tags, m.note, m.display_name, m.cycle_override,
       COALESCE(m.manual_cat, 0) AS manual_cat, m.transfer_reason
     FROM transactions t LEFT JOIN tx_meta m ON m.tx_id = t.id WHERE t.id = ?`,
    [id],
  );
}

export type TxMeta = { category_id: string | null; tags: string[]; note: string | null; display_name: string | null; cycle_override: string | null };

/** Salva o que você editou. Se a categoria mudou, ela vira "sua" e o app não troca mais sozinho. */
export async function saveMeta(txId: string, m: TxMeta): Promise<void> {
  const db = await getDb();
  const prev = await db.getFirstAsync<{ category_id: string | null; manual_cat: number; transfer_reason: string | null }>(
    'SELECT category_id, COALESCE(manual_cat, 0) AS manual_cat, transfer_reason FROM tx_meta WHERE tx_id = ?', [txId]);
  const changed = (prev?.category_id ?? null) !== m.category_id;
  const manualCat = changed ? 1 : prev?.manual_cat ?? 0;
  await db.runAsync(
    `INSERT OR REPLACE INTO tx_meta (tx_id, category_id, tags, note, display_name, cycle_override, manual_cat, transfer_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [txId, m.category_id, JSON.stringify(m.tags), m.note, m.display_name, m.cycle_override, manualCat,
      changed ? null : prev?.transfer_reason ?? null],
  );
}

// ---------- Transferências entre suas contas ----------

export type TransferSettings = { enabled: boolean; names: string[]; docs: string[] };

export async function getTransferSettings(): Promise<TransferSettings> {
  const raw = await getSetting('transfer_settings');
  const def: TransferSettings = { enabled: true, names: [], docs: [] };
  try {
    return raw ? { ...def, ...JSON.parse(raw) } : def;
  } catch {
    return def;
  }
}

export async function setTransferSettings(s: TransferSettings): Promise<void> {
  await setSetting('transfer_settings', JSON.stringify(s));
}

/** Sugestão do seu nome: o nome que mais aparece como "quem pagou" nas suas saídas por Pix/TED. */
export async function suggestOwnName(): Promise<string | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ n: string; c: number }>(
    `SELECT counterpart AS n, COUNT(*) AS c FROM transactions WHERE type = 'CREDIT' AND same_owner = 1 AND counterpart IS NOT NULL
     GROUP BY counterpart ORDER BY c DESC LIMIT 1`);
  return r?.n ?? null;
}

/**
 * Procura transferências entre suas contas e marca como "Entre minhas contas" (fora do gráfico).
 * Nunca mexe em lançamento cuja categoria você escolheu. Devolve quantos estão marcados agora.
 */
export async function applyTransferDetection(): Promise<number> {
  const db = await getDb();
  const st = await getTransferSettings();
  const rows = await db.getAllAsync<{
    id: string; account_id: string | null; date: string; description: string; amount: number; type: 'DEBIT' | 'CREDIT';
    pluggy_category: string | null; payer_doc: string | null; receiver_doc: string | null; same_owner: number | null;
    category_id: string | null; manual_cat: number; transfer_reason: string | null;
  }>(
    `SELECT t.id, t.account_id, t.date, t.description, t.amount, t.type, t.pluggy_category, t.payer_doc, t.receiver_doc,
       t.same_owner, m.category_id, COALESCE(m.manual_cat, 0) AS manual_cat, m.transfer_reason
     FROM transactions t LEFT JOIN tx_meta m ON m.tx_id = t.id
     WHERE t.source = 'pluggy' AND t.date >= date('now', '-400 days')`,
  );
  const accs = await db.getAllAsync<{ id: string }>(`SELECT id FROM accounts WHERE type = 'BANK'`);
  const docs = new Set([...st.docs, ...guessOwnDocs(rows)]);
  const found = st.enabled
    ? detectTransfers(rows, { ownAccountIds: new Set(accs.map((a) => a.id)), ownDocs: docs, ownNames: st.names })
    : new Map<string, TransferReason>();

  let marked = 0;
  await db.withTransactionAsync(async () => {
    for (const r of rows) {
      if (r.manual_cat === 1) continue; // você decidiu: o app respeita
      const reason = found.get(r.id);
      if (reason) {
        marked++;
        if (r.category_id === 'transferencia' && r.transfer_reason === reason) continue;
        await db.runAsync(
          `INSERT INTO tx_meta (tx_id, category_id, tags, transfer_reason) VALUES (?, 'transferencia', '[]', ?)
           ON CONFLICT(tx_id) DO UPDATE SET category_id = 'transferencia', transfer_reason = excluded.transfer_reason`,
          [r.id, reason],
        );
      } else if (r.transfer_reason && r.category_id === 'transferencia') {
        // Tinha sido marcado pelo app, mas não é mais (ex.: você tirou seu nome dos Ajustes)
        const cat = r.type === 'DEBIT' ? guessCategory(r.pluggy_category, r.description) : null;
        await db.runAsync('UPDATE tx_meta SET category_id = ?, transfer_reason = NULL WHERE tx_id = ?', [cat === 'transferencia' ? null : cat, r.id]);
      }
    }
  });
  return marked;
}

/** "Não é transferência": volta a contar como gasto/entrada normal, e o app não marca de novo. */
export async function markNotTransfer(txId: string, categoryId: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO tx_meta (tx_id, category_id, tags, manual_cat, transfer_reason) VALUES (?, ?, '[]', 1, NULL)
     ON CONFLICT(tx_id) DO UPDATE SET category_id = excluded.category_id, manual_cat = 1, transfer_reason = NULL`,
    [txId, categoryId],
  );
}

export async function insertManual(t: Omit<TxBase, 'id' | 'source' | 'pluggy_category' | 'installment_number' | 'total_installments'>): Promise<string> {
  const db = await getDb();
  const id = `manual-${Date.now().toString(36)}`;
  await db.runAsync(
    `INSERT INTO transactions (id, account_id, date, description, amount, type, source) VALUES (?, ?, ?, ?, ?, ?, 'manual')`,
    [id, t.account_id, t.date, t.description, t.amount, t.type],
  );
  return id;
}

export async function updateManual(id: string, t: Pick<TxBase, 'date' | 'description' | 'amount' | 'type'>): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE transactions SET date = ?, description = ?, amount = ?, type = ? WHERE id = ? AND source = 'manual'`, [
    t.date, t.description, t.amount, t.type, id,
  ]);
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM tx_meta WHERE tx_id = ?', [id]);
}

export async function allTags(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ tags: string }>(`SELECT tags FROM tx_meta WHERE tags != '[]'`);
  const set = new Set<string>(['#presente', '#família', '#reembolsável', '#imprevisto']);
  for (const r of rows) parseTags(r.tags).forEach((t) => set.add(t));
  return Array.from(set).sort();
}

// ---------- Regras automáticas ----------

export async function listRules(): Promise<Rule[]> {
  const db = await getDb();
  return db.getAllAsync<Rule>('SELECT * FROM rules ORDER BY id DESC');
}

/** Cria a regra e já aplica nos lançamentos parecidos que ainda estão sem categoria. */
export async function addRuleFrom(description: string, categoryId: string | null, tags: string[]): Promise<number> {
  const db = await getDb();
  const pattern = rulePattern(description);
  if (!pattern) return 0;
  await db.runAsync('DELETE FROM rules WHERE pattern = ?', [pattern]);
  await db.runAsync('INSERT INTO rules (pattern, category_id, tags) VALUES (?, ?, ?)', [pattern, categoryId, JSON.stringify(tags)]);
  const rows = await db.getAllAsync<{ id: string; description: string }>(
    `SELECT t.id, t.description FROM transactions t LEFT JOIN tx_meta m ON m.tx_id = t.id
     WHERE m.category_id IS NULL AND t.type = 'DEBIT'`,
  );
  let n = 0;
  for (const r of rows) {
    if (rulePattern(r.description).includes(pattern)) {
      await db.runAsync(
        `INSERT INTO tx_meta (tx_id, category_id, tags, manual_cat) VALUES (?, ?, ?, 1)
         ON CONFLICT(tx_id) DO UPDATE SET category_id = excluded.category_id, tags = excluded.tags, manual_cat = 1`,
        [r.id, categoryId, JSON.stringify(tags)],
      );
      n++;
    }
  }
  return n;
}

export async function deleteRule(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM rules WHERE id = ?', [id]);
}

// ---------- Contas fixas ----------

export async function listBills(): Promise<Bill[]> {
  const db = await getDb();
  return db.getAllAsync<Bill>('SELECT * FROM bills WHERE active = 1 ORDER BY due_day, name');
}

export async function getBill(id: number): Promise<Bill | null> {
  const db = await getDb();
  return db.getFirstAsync<Bill>('SELECT * FROM bills WHERE id = ?', [id]);
}

export async function saveBill(b: Omit<Bill, 'id' | 'active'> & { id?: number }): Promise<void> {
  const db = await getDb();
  if (b.id) {
    await db.runAsync(
      `UPDATE bills SET name = ?, category_id = ?, amount = ?, variable = ?, due_day = ?, cycle = ?, keyword = ?, account_id = ? WHERE id = ?`,
      [b.name, b.category_id, b.amount, b.variable, b.due_day, b.cycle, b.keyword, b.account_id, b.id],
    );
  } else {
    await db.runAsync(
      `INSERT INTO bills (name, category_id, amount, variable, due_day, cycle, keyword, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.name, b.category_id, b.amount, b.variable, b.due_day, b.cycle, b.keyword, b.account_id],
    );
  }
}

export async function deleteBill(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM bills WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM bill_manual WHERE bill_id = ?', [id]);
}

export async function listBillManual(): Promise<BillManual[]> {
  const db = await getDb();
  return db.getAllAsync<BillManual>('SELECT * FROM bill_manual');
}

/** paid: true/false = marcação manual; null = volta para automático */
export async function setBillManual(billId: number, ym: string, paid: boolean | null): Promise<void> {
  const db = await getDb();
  if (paid === null) {
    await db.runAsync('DELETE FROM bill_manual WHERE bill_id = ? AND ym = ?', [billId, ym]);
  } else {
    await db.runAsync('INSERT OR REPLACE INTO bill_manual (bill_id, ym, paid) VALUES (?, ?, ?)', [billId, ym, paid ? 1 : 0]);
  }
}

// ---------- Apagar tudo ----------

export async function wipeAll(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM transactions; DELETE FROM tx_meta; DELETE FROM accounts; DELETE FROM rules;
    DELETE FROM bills; DELETE FROM bill_manual; DELETE FROM settings; DELETE FROM investments; DELETE FROM account_alias; DELETE FROM market_cache;
  `);
}
