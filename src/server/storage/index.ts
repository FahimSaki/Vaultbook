import { hkdfSync } from "node:crypto";
import path from "node:path";
import { config } from "../config";
import { EncryptedStore } from "./encrypted";
import { LocalFsStore } from "./local";
import type { BlobStore } from "./types";

export function getStore(dek: Buffer): BlobStore {
  const base = new LocalFsStore(path.resolve(config.dataDir, "blobs"));
  const key = Buffer.from(
    hkdfSync("sha256", dek, Buffer.alloc(0), "vaultbook-images", 32),
  );
  return new EncryptedStore(base, key);
}
