import { hkdfSync } from "node:crypto";
import path from "node:path";
import { config } from "../config";
import { EncryptedStore } from "./encrypted";
import { LocalFsStore } from "./local";
import type { BlobStore } from "./types";

function baseStore(): BlobStore {
  if (config.s3Bucket) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    // Loaded lazily so the portable build never bundles the AWS SDK.
    const { S3Store } = require("./s3") as typeof import("./s3");
    /* eslint-enable @typescript-eslint/no-require-imports */
    return new S3Store();
  }
  return new LocalFsStore(path.resolve(config.dataDir, "blobs"));
}

export function getStore(dek: Buffer): BlobStore {
  const key = Buffer.from(
    hkdfSync("sha256", dek, Buffer.alloc(0), "vaultbook-images", 32),
  );
  return new EncryptedStore(baseStore(), key);
}
