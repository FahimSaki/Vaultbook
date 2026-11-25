import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { config } from "@/server/config";
import {
  createVault,
  lockVault,
  __resetThrottleForTests,
} from "@/server/portable/vault";
import { backupEntries } from "@/server/portable/backup";

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "vb-tar-"));
  config.dataDir = dir;
  __resetThrottleForTests();
});
afterEach(async () => {
  await lockVault({ force: true }).catch(() => {});
  await fs.rm(dir, { recursive: true, force: true });
});

describe("backup tar", () => {
  it("contains the sealed vault and the photo blobs", async () => {
    await createVault("correct horse battery", "Shop");
    await fs.mkdir(path.join(dir, "blobs/org/x"), { recursive: true });
    await fs.writeFile(path.join(dir, "blobs/org/x/a-full.webp"), "CIPHER");

    const chunks: Buffer[] = [];
    for await (const c of backupEntries()) chunks.push(c);
    const tar = Buffer.concat(chunks);

    expect(tar.length % 512).toBe(0);
    expect(tar.subarray(0, 9).toString()).toBe("vault.enc");
    const size = parseInt(tar.subarray(124, 135).toString(), 8);
    const vault = await fs.readFile(path.join(dir, "vault.enc"));
    expect(size).toBe(vault.length);
    expect(tar.includes("blobs/org/x/a-full.webp")).toBe(true);
    expect(tar.subarray(-1024).every((b) => b === 0)).toBe(true);
  });
});
