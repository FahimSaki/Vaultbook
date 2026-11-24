import fs from "node:fs/promises";
import path from "node:path";
import type { BlobStore } from "./types";

export class LocalFsStore implements BlobStore {
  constructor(private root: string) {}
  private file(key: string) {
    if (!/^[a-zA-Z0-9/_.-]+$/.test(key) || key.includes(".."))
      throw new Error("bad key");
    return path.join(this.root, key);
  }
  async put(key: string, data: Buffer) {
    const f = this.file(key);
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f + ".tmp", data);
    await fs.rename(f + ".tmp", f);
  }
  get(key: string) {
    return fs.readFile(this.file(key));
  }
  delete(key: string) {
    return fs.rm(this.file(key), { force: true });
  }
}
