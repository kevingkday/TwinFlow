import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../drizzle/migrations');

class BoundStatement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: unknown[]
  ) {}

  private normalizedParams(): unknown[] {
    return this.params.map((value) => (value === undefined ? null : value));
  }

  async all() {
    const stmt = this.db.prepare(this.sql);
    const results = stmt.all(...(this.normalizedParams() as never[]));
    return { results, success: true, meta: {} };
  }

  async run() {
    const stmt = this.db.prepare(this.sql);
    const info = stmt.run(...(this.normalizedParams() as never[]));
    return {
      success: true,
      meta: { changes: info.changes, last_row_id: info.lastInsertRowid },
    };
  }

  async raw() {
    const stmt = this.db.prepare(this.sql);
    stmt.setReturnArrays(true);
    return stmt.all(...(this.normalizedParams() as never[]));
  }
}

class D1Statement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string
  ) {}

  bind(...params: unknown[]) {
    return new BoundStatement(this.db, this.sql, params);
  }
}

export class D1Shim {
  constructor(private readonly db: DatabaseSync) {}

  prepare(sql: string) {
    return new D1Statement(this.db, sql);
  }

  async exec(sql: string) {
    this.db.exec(sql);
    return { count: 0, duration: 0 };
  }

  async batch(statements: BoundStatement[]) {
    const results = [];
    for (const statement of statements) {
      const sql = (statement as unknown as { sql: string }).sql || '';
      if (/^\s*(select|with|pragma)\b/i.test(sql)) {
        results.push(await statement.all());
      } else {
        results.push(await statement.run());
      }
    }
    return results;
  }
}

function applyMigrations(db: DatabaseSync) {
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const raw = readFileSync(join(migrationsDir, file), 'utf8');
    for (const statement of raw.split('--> statement-breakpoint')) {
      const sql = statement.trim();
      if (sql) db.exec(sql);
    }
  }

  const columns = db.prepare(`PRAGMA table_info(signals)`).all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'article_summary')) {
    db.exec('ALTER TABLE signals ADD COLUMN article_summary text');
  }
}

export function createTestDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  applyMigrations(sqlite);
  return { sqlite, DB: new D1Shim(sqlite) };
}
