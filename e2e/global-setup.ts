import fs from "node:fs/promises";

// Start every run from "no vault yet". The server reads the disk on each request,
// so deleting the folder after it has started is safe.
export default async function globalSetup() {
  await fs.rm(".e2e-data", { recursive: true, force: true });
}
