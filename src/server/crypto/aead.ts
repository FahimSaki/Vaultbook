import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = 1;

/** Output layout: version(1) | iv(12) | tag(16) | ciphertext */
export function seal(key: Buffer, plaintext: Buffer, aad: string): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plaintext), c.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, c.getAuthTag(), ct]);
}

export function open(key: Buffer, blob: Buffer, aad: string): Buffer {
  if (blob.length < 29 || blob[0] !== VERSION) {
    throw new Error("unsupported ciphertext");
  }
  const d = createDecipheriv("aes-256-gcm", key, blob.subarray(1, 13));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(blob.subarray(13, 29));
  return Buffer.concat([d.update(blob.subarray(29)), d.final()]); // throws on tamper / wrong key / wrong aad
}
