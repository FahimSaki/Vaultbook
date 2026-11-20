import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { config } from "@/server/config";
import {
  createVault,
  unlockVault,
  lockVault,
  getSession,
  requireSession,
  markDirty,
  flush,
  unlockWithRecovery,
  __dropSessionForTests,
  __resetThrottleForTests,
} from "@/server/portable/vault";
import { Locked } from "@/lib/errors";

const PW = "correct horse battery";
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
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "vb-"));
  config.dataDir = dir;
  __resetThrottleForTests();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await lockVault().catch(() => {});
  await fs.rm(dir, { recursive: true, force: true });
});

describe("vault", () => {
  it("create, lock, unlock: data comes back", async () => {
    await createVault(PW, "Shop");
    await addProduct("A1");
    await lockVault();
    await unlockVault(PW);
    expect(await skus()).toEqual(["A1"]);
  });

  it("wrong password is rejected and nothing opens", async () => {
    await createVault(PW, "Shop");
    await lockVault();
    await expect(unlockVault("not the password!!")).rejects.toThrow(
      /Wrong password/,
    );
    expect(getSession()).toBeNull();
  });

  it("a flipped byte makes unlock fail", async () => {
    await createVault(PW, "Shop");
    await lockVault();
    const f = path.join(dir, "vault.enc");
    const raw = await fs.readFile(f);
    raw[raw.length - 1] ^= 1;
    await fs.writeFile(f, raw);
    await expect(unlockVault(PW)).rejects.toThrow();
  });

  it("the file on disk contains no plaintext", async () => {
    await createVault(PW, "Shop");
    await addProduct("UNIQUE-SKU-XYZ");
    await lockVault();
    const raw = await fs.readFile(path.join(dir, "vault.enc"));
    expect(raw.includes("UNIQUE-SKU-XYZ")).toBe(false);
  });

  it("a crash during save keeps the previous vault intact", async () => {
    await createVault(PW, "Shop");
    await addProduct("OLD");
    await lockVault();
    await unlockVault(PW);
    await addProduct("NEW");

    const real = fs.rename.bind(fs);
    vi.spyOn(fs, "rename").mockImplementation(
      async (...a: Parameters<typeof fs.rename>) => {
        if (String(a[1]).endsWith("vault.enc")) throw new Error("power cut");
        return real(...a);
      },
    );
    await expect(flush()).rejects.toThrow("power cut");
    vi.restoreAllMocks();

    await __dropSessionForTests(); // process "dies" without saving
    await unlockVault(PW);
    expect(await skus()).toEqual(["OLD"]);
  });

  it("recovery code unlocks and issues a new one", async () => {
    const code = await createVault(PW, "Shop");
    await addProduct("A1");
    await lockVault();
    const newCode = await unlockWithRecovery(code, "a brand new passphrase");
    expect(newCode).not.toBe(code);
    await lockVault();
    await expect(unlockVault(PW)).rejects.toThrow(/Wrong password/);
    __resetThrottleForTests();
    await unlockVault("a brand new passphrase");
    expect(await skus()).toEqual(["A1"]);
    await lockVault();
    await expect(
      unlockWithRecovery(code, "yet another passphrase"),
    ).rejects.toThrow(/not valid/); // old code is dead
  });

  it("requireSession throws after lock", async () => {
    await createVault(PW, "Shop");
    await lockVault();
    expect(() => requireSession()).toThrow(Locked);
  });
});
