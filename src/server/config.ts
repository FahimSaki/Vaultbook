export type Mode = "portable" | "selfhost" | "cloud";

export const config = {
  mode: (process.env.DEPLOY_MODE ?? "portable") as Mode,
  dataDir: process.env.DATA_DIR ?? "./data",
  migrationsDir: process.env.MIGRATIONS_DIR ?? "./src/server/db/migrations",
  databaseUrl: process.env.DATABASE_URL,
  migrationUrl: process.env.MIGRATION_DATABASE_URL,
  masterKey: process.env.MASTER_KEY,
  s3Bucket: process.env.S3_BUCKET,
};

export const isPortable = config.mode === "portable";
