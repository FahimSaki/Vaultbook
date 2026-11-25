import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { config } from "../config";
import { flush } from "./vault";

// A minimal ustar writer: no dependency, and every file inside is already ciphertext.
const BLOCK = 512;

function header(name: string, size: number, mtime: Date) {
  if (Buffer.byteLength(name) > 100) throw new Error("backup path too long");
  const h = Buffer.alloc(BLOCK);
  h.write(name, 0, 100, "utf8");
  h.write("0000644\0", 100);
  h.write("0000000\0", 108);
  h.write("0000000\0", 116);
  h.write(size.toString(8).padStart(11, "0") + "\0", 124);
  h.write(
    Math.floor(mtime.getTime() / 1000)
      .toString(8)
      .padStart(11, "0") + "\0",
    136,
  );
  h.write("        ", 148); // checksum field counts as spaces while summing
  h.write("0", 156);
  h.write("ustar\0", 257);
  h.write("00", 263);
  let sum = 0;
  for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
  return h;
}

const padding = (n: number) => Buffer.alloc((BLOCK - (n % BLOCK)) % BLOCK);

async function* walk(
  dir: string,
  prefix: string,
): AsyncGenerator<[string, string]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return; // no photos yet
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full, prefix + e.name + "/");
    else if (e.isFile() && !e.name.endsWith(".tmp"))
      yield [full, prefix + e.name];
  }
}

export async function* backupEntries(): AsyncGenerator<Buffer> {
  await flush(); // make sure vault.enc is current
  const files: [string, string][] = [
    [path.join(config.dataDir, "vault.enc"), "vault.enc"],
  ];
  for await (const f of walk(path.join(config.dataDir, "blobs"), "blobs/"))
    files.push(f);

  for (const [full, name] of files) {
    const [data, st] = await Promise.all([fs.readFile(full), fs.stat(full)]);
    yield header(name, data.length, st.mtime);
    yield data;
    yield padding(data.length);
  }
  yield Buffer.alloc(BLOCK * 2); // end-of-archive marker
}

export const backupStream = () =>
  Readable.toWeb(
    Readable.from(backupEntries()),
  ) as unknown as ReadableStream<Uint8Array>;
