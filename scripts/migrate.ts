import { Pool } from "pg";
import { migrate } from "../src/server/db/migrate";

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error("MIGRATION_DATABASE_URL is not set");

  const pool = new Pool({ connectionString: url, max: 1 });

  try {
    const applied = await migrate(
      {
        exec: async (s) => {
          await pool.query(s);
        },
        query: async <T = unknown>(s: string, p?: unknown[]) =>
          (await pool.query(s, p)).rows as T[],
      },
      process.env.MIGRATIONS_DIR ?? "src/server/db/migrations",
    );

    console.log(
      applied.length ? "Applied: " + applied.join(", ") : "Nothing to apply.",
    );
  } finally {
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
