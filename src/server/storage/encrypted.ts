import { open, seal } from "../crypto/aead";
import type { BlobStore } from "./types";

// Decorator: the inner store only ever sees ciphertext.
export class EncryptedStore implements BlobStore {
  constructor(
    private inner: BlobStore,
    private key: Buffer,
  ) {}
  put(k: string, d: Buffer, contentType = "application/octet-stream") {
    return this.inner.put(k, seal(this.key, d, "img:" + k), contentType);
  }
  async get(k: string) {
    return open(this.key, await this.inner.get(k), "img:" + k);
  }
  delete(k: string) {
    return this.inner.delete(k);
  }
}
