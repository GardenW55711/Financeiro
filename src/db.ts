// Banco de dados local (SQLite) — fica só no celular.
// Analogia: é um caderno guardado na gaveta do próprio aparelho.

import * as SQLite from 'expo-sqlite';
import { Category, DEFAULT_CATEGORIES, guessCategory, matchRule, Rule } from './lib/categories';
import { Bill, BillManual } from './lib/bills';
import { DEFAULT_PAY_SETTINGS, PaySettings } from './lib/paydays';
import { rulePattern } from './lib/format';

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
    CREATE TABLE IF NOT EXISTS bill_manual (
      bill_id INTEGER NOT NULL, ym TEXT NOT NULL, paid INTEGER NOT NULL, PRIMARY KEY (bill_id, ym)
    );
  `);
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
  return db.getAllAsync<Account>('SELECT * FROM accounts ORDER BY type, bank_name, name');
}

export function accountLabel(a: Pick<Account, 'type' | 'name' | 'number' | 'bank_name'>): string {
  const tail = a.number ? ` ••${a.number.replace(/\D/g, '').slice(-4)}` : '';
  if (a.type === 'CREDIT') return `Crédito${tail}`;
  if (a.type === 'MANUAL') return 'Manual';
  return `Conta${tail}`;
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
};

export type TxBase = Pick<Tx, 'id' | 'account_id' | 'date' | 'description' | 'amount' | 'type' | 'pluggy_category' |
  'installment_number' | 'total_installments' | 'source'>;

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
          installment_number, total_installments, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.id, t.account_id, t.date, t.description, t.amount, t.type, t.pluggy_category,
          t.installment_number, t.total_installments, t.source],
      );
      const meta = await db.getFirstAsync<{ tx_id: string }>('SELECT tx_id FROM tx_meta WHERE tx_id = ?', [t.id]);
      if (!meta) {
        created++;
        const rule = matchRule(rules, t.description);
        const cat = rule?.category_id ?? (t.type === 'DEBIT' ? guessCategory(t.pluggy_category, t.description) : null);
        await db.runAsync('INSERT INTO tx_meta (tx_id, category_id, tags) VALUES (?, ?, ?)', [t.id, cat, rule?.tags ?? '[]']);
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
    `SELECT t.*, m.category_id, COALESCE(m.tags, '[]') AS tags, m.note, m.display_name, m.cycle_override
     FROM transactions t LEFT JOIN tx_meta m ON m.tx_id = t.id
     WHERE ${where} ORDER BY t.date DESC, t.id`,
    params,
  );
}

export async function getTransaction(id: string): Promise<Tx | null> {
  const db = await getDb();
  return db.getFirstAsync<Tx>(
    `SELECT t.*, m.category_id, COALESCE(m.tags, '[]') AS tags, m.note, m.display_name, m.cycle_override
     FROM transactions t LEFT JOIN tx_meta m ON m.tx_id = t.id WHERE t.id = ?`,
    [id],
  );
}

export type TxMeta = { category_id: string | null; tags: string[]; note: string | null; display_name: string | null; cycle_override: string | null };

export async function saveMeta(txId: string, m: TxMeta): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO tx_meta (tx_id, category_id, tags, note, display_name, cycle_override) VALUES (?, ?, ?, ?, ?, ?)`,
    [txId, m.category_id, JSON.stringify(m.tags), m.note, m.display_name, m.cycle_override],
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
        `INSERT INTO tx_meta (tx_id, category_id, tags) VALUES (?, ?, ?)
         ON CONFLICT(tx_id) DO UPDATE SET category_id = excluded.category_id, tags = excluded.tags`,
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
    DELETE FROM bills; DELETE FROM bill_manual; DELETE FROM settings;
  `);
}
