import { defineConfig, devices } from "@playwright/test";

const PORT = 4799;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1, // the portable vault is a single session
  fullyParallel: false,
  retries: 0, // tests share one vault, so a retry would start from dirty state
  timeout: 60_000,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build && pnpm start -H 127.0.0.1 -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/heartbeat`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      ...(process.env as Record<string, string>),
      DEPLOY_MODE: "portable",
      DATA_DIR: ".e2e-data",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
