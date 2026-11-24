// Обёртка над встроенным SQLite из Node в виде D1 — для тестов и локального сервера.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { DB, Stmt } from './index';

export function localDB(file = ':memory:', schema = new URL('../schema.sql', import.meta.url)): DB {
  const db = new DatabaseSync(file);
  db.exec(readFileSync(schema, 'utf8'));
  const stmt = (sql: string, args: unknown[] = []): Stmt => ({
    bind: (...v: unknown[]) => stmt(sql, v),
    first: async <T,>() => (db.prepare(sql).get(...(args as never[])) as T | undefined) ?? null,
    all: async <T,>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
    run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
  });
  return { prepare: (sql) => stmt(sql), batch: async (list) => Promise.all(list.map((s) => s.run())) };
}
