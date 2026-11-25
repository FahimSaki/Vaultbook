export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { isPortable, config } = await import("./server/config");

  if (isPortable) {
    const { lockVault } = await import("./server/portable/vault");
    for (const sig of ["SIGINT", "SIGTERM"] as const) {
      process.on(
        sig,
        () => void lockVault({ force: true }).finally(() => process.exit(0)),
      );
    }
    return;
  }

  // Self-host: apply migrations with the owner role before serving traffic.
  // MIGRATION_DATABASE_URL is set only in the self-host compose file, never on Vercel.
  if (config.migrationUrl) {
    const { Pool } = await import("pg");
    const { migrate } = await import("./server/db/migrate");
    const pool = new Pool({ connectionString: config.migrationUrl, max: 1 });
    try {
      const applied = await migrate(
        {
          exec: async (s) => {
            await pool.query(s);
          },
          query: async <T = unknown>(s: string, p?: unknown[]) =>
            (await pool.query(s, p)).rows as T[],
        },
        config.migrationsDir,
      );
      if (applied.length)
        console.log("Applied migrations:", applied.join(", "));
    } finally {
      await pool.end();
    }
  }
}
