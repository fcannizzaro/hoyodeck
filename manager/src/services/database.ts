import { Database } from 'bun:sqlite'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

const DATA_DIR = join(import.meta.dirname, '..', '..', 'data')
mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = join(DATA_DIR, 'codes.db')

/** Singleton database instance */
let _db: Database | null = null

export function getDb(): Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.run('PRAGMA journal_mode = WAL')
    _db.run('PRAGMA foreign_keys = ON')
    migrate(_db)
  }
  return _db
}

function migrate(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS codes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      game           TEXT NOT NULL CHECK(game IN ('gi', 'hsr', 'zzz')),
      code           TEXT NOT NULL,
      rewards        TEXT,
      source         TEXT,
      discovered_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      expires_at     INTEGER,
      UNIQUE(game, code)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS code_claims (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      code_id    INTEGER NOT NULL REFERENCES codes(id),
      account_id TEXT NOT NULL,
      status     TEXT NOT NULL CHECK(status IN ('claimed', 'dismissed', 'failed', 'expired')),
      claimed_at INTEGER NOT NULL DEFAULT (unixepoch()),
      message    TEXT,
      UNIQUE(code_id, account_id)
    )
  `)
}
