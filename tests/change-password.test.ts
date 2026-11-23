import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { config } from "@/server/config";
import {
  createVault,
  unlockVault,
  unlockWithRecovery,
  changePassword,
  lockVault,
  getSession,
  markDirty,
  readVaultForBackup,
  __resetThrottleForTests,
} from "@/server/portable/vault";

const PW = "correct horse battery";
const NEW_PW = "a brand new passphrase";
let dir: string;

const addProduct = async (sku: string) => {
  await getSession()!.pg.query(
    "INSERT INTO products (org_id, sku, name, sell_price_cents) VALUES ($1,$2,$2,100)",
    [getSession()!.orgId, sku],
  );
  markDirty();
};
const skus = async () =>
  (
    await getSession()!.pg.query<{ sku: string }>(
      "SELECT sku FROM products ORDER BY sku",
    )
  ).rows.map((r) => r.sku);

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "vb-pw-"));
  config.dataDir = dir;
  __resetThrottleForTests();
});
afterEach(async () => {
  await lockVault().catch(() => {});
  await fs.rm(dir, { recursive: true, force: true });
});

describe("changePassword", () => {
  it("rejects a wrong current password and a short new one", async () => {
    await createVault(PW, "Shop");
    await expect(changePassword("not the password", NEW_PW)).rejects.toThrow(
      /Current password/,
    );
    await expect(changePassword(PW, "short")).rejects.toThrow(/12 characters/);
  });

  it("issues a new recovery code, kills the old one, keeps the data", async () => {
    const oldCode = await createVault(PW, "Shop");
    await addProduct("A1");
    const newCode = await changePassword(PW, NEW_PW);
    expect(newCode).not.toBe(oldCode);
    await lockVault();

    await expect(unlockVault(PW)).rejects.toThrow(/Wrong password/);
    __resetThrottleForTests();
    await unlockVault(NEW_PW);
    expect(await skus()).toEqual(["A1"]);
    await lockVault();

    await expect(
      unlockWithRecovery(oldCode, "yet another passphrase"),
    ).rejects.toThrow(/not valid/);
    await unlockWithRecovery(newCode, "yet another passphrase"); // the new code works
    expect(await skus()).toEqual(["A1"]);
  });

  it("backup is sealed and opens with the password", async () => {
    await createVault(PW, "Shop");
    await addProduct("UNIQUE-BACKUP-SKU");
    const raw = await readVaultForBackup();
    expect(raw.includes("UNIQUE-BACKUP-SKU")).toBe(false);
    expect(raw.subarray(0, 8).toString()).toBe("VBVAULT1");
  });
});
