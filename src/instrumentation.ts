export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { isPortable } = await import("./server/config");
  if (!isPortable) return; // hosted migrations are added in Step 14
  const { lockVault } = await import("./server/portable/vault");
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => void lockVault().finally(() => process.exit(0)));
  }
}
