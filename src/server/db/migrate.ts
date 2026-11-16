
import fs from 'node:fs/promises';
import path from 'node:path';

export interface SqlExec {
  exec(sql: string): Promise<void>;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}

export async function migrate(
  x: SqlExec,
  dir: string,
  include: (file: string) => boolean = () => true,
): Promise<string[]> {
  await x.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );

  const done = new Set(
    (await x.query<{ name: string }>('SELECT name FROM schema_migrations')).map((r) => r.name),
  );

  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];

  for (const f of files) {
    if (done.has(f) || !include(f)) continue;

    const sql = await fs.readFile(path.join(dir, f), 'utf8');

    try {
      await x.exec(
        ['BEGIN;', sql, `INSERT INTO schema_migrations (name) VALUES ('${f}');`, 'COMMIT;'].join('\n'),
      );
      applied.push(f);
    } catch (e) {
      await x.exec('ROLLBACK;').catch(() => {});
      throw new Error(`Migration ${f} failed: ${(e as Error).message}`);
    }
  }

  return applied;
}

// Hosted-only files contain one of these words in the filename.
export const portableFilter = (f: string) =>
  !f.includes('rls') && !f.includes('auth') && !f.includes('signup');
