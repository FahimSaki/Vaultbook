/**
 * Seeds (or resets) the HOSTED demo database. Run from your laptop for the first fill:
 *   pnpm db:seed-demo          (reads .env.demo)
 * The nightly reset is the same code behind /api/cron/reset-demo.
 */
import { config } from "../src/server/config";
import { seedDemo } from "../src/server/seed/demo";

async function main() {
  if (config.mode === "portable")
    throw new Error("Set DEPLOY_MODE=cloud (see .env.demo).");
  if (!config.databaseUrl) throw new Error("DATABASE_URL is not set.");
  const t0 = Date.now();
  const r = await seedDemo();
  console.log(
    `Demo seeded: ${r.products} products in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
