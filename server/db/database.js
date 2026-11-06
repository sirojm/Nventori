import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../../nventori.db');
const schemaPath = path.resolve(__dirname, 'schema.sql');

export const db = new DatabaseSync(dbPath);

// Enable foreign keys and WAL mode for better concurrency
db.exec('PRAGMA foreign_keys = ON;');
try {
  db.exec('PRAGMA journal_mode = WAL;');
} catch (e) {
  // WAL mode might not be strictly required on single process
}

// Initialize schema
export function initDatabase() {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  const receiptTokenColumns = db.prepare('PRAGMA table_info(receipt_verification_tokens)').all();
  if (receiptTokenColumns.some(column => column.name === 'token_hash')) {
    db.exec(`
      DROP TABLE receipt_verification_tokens;
      CREATE TABLE receipt_verification_tokens (
        token TEXT PRIMARY KEY,
        transaction_id INTEGER NOT NULL,
        document_type TEXT NOT NULL CHECK(document_type IN ('handover', 'return')),
        event_id INTEGER NOT NULL,
        issued_by_id INTEGER NOT NULL,
        issued_by_name TEXT NOT NULL,
        issued_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(document_type, event_id),
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (issued_by_id) REFERENCES users(id)
      );
    `);
  }

  // Migration: soft-delete flag for kits (older databases were created without it)
  const kitColumns = db.prepare('PRAGMA table_info(asset_kits)').all();
  if (!kitColumns.some(column => column.name === 'is_active')) {
    db.exec('ALTER TABLE asset_kits ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;');
  }

  console.log('[DB] Nventori SQLite Database initialized successfully.');
}

// Database helper functions
export const query = {
  all(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  },
  get(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  },
  run(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  },
  exec(sql) {
    return db.exec(sql);
  },
  transaction(fn) {
    return (...args) => {
      db.exec('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        db.exec('COMMIT');
        return result;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    };
  }
};
