import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { processImage } from "@/server/storage/process";
import { LocalFsStore } from "@/server/storage/local";
import { EncryptedStore } from "@/server/storage/encrypted";

describe("images", () => {
  it("strips EXIF and makes a 256px thumbnail", async () => {
    const src = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#f00" },
    })
      .jpeg()
      .withExif({ IFD0: { Copyright: "secret-location" } })
      .toBuffer();
    expect((await sharp(src).metadata()).exif).toBeDefined();
    const { full, thumb } = await processImage(src);
    expect((await sharp(full).metadata()).exif).toBeUndefined();
    expect(full.includes("secret-location")).toBe(false);
    expect((await sharp(thumb).metadata()).width).toBe(256);
  });

  it("rejects non-images", async () => {
    await expect(processImage(Buffer.from("not an image"))).rejects.toThrow();
  });

  it("stores only ciphertext on disk and round-trips", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vb-img-"));
    const store = new EncryptedStore(new LocalFsStore(dir), randomBytes(32));
    const data = Buffer.from("PLAINTEXT-MARKER");
    await store.put("org/o/a-full.webp", data, "image/webp");
    expect(
      (await fs.readFile(path.join(dir, "org/o/a-full.webp"))).includes(
        "PLAINTEXT-MARKER",
      ),
    ).toBe(false);
    expect((await store.get("org/o/a-full.webp")).equals(data)).toBe(true);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
