import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { seal, open } from "../crypto/aead";
import {
  deriveKekFromPassword,
  newSalt,
  newDek,
  wrapDek,
  unwrapDek,
} from "../crypto/keys";
import { migrate, portableFilter } from "../db/migrate";
import { pgliteExec } from "../db/pglite-exec";
import * as schema from "../db/schema";
import type { Db } from "../db/client";
import { config } from "../config";
import { Locked, UserError } from "@/lib/errors";

// File layout: MAGIC(8) | salt(16) | len(2) | recovery-wrapped KEK | sealed DB tarball
const MAGIC = Buffer.from("VBVAULT1");
const IDLE_MS = 15 * 60 * 1000;
const vaultPath = () => path.join(config.dataDir, "vault.enc");

export type Session = {
  pg: PGlite;
  db: Db;
  kek: Buffer;
  dek: Buffer;
  salt: Buffer;
  wrappedKek: Buffer;
  orgId: string;
  dirty: boolean;
  timer?: NodeJS.Timeout;
  chain: Promise<void>;
  lastActive: number;
  lastBackup: number;
  id: string;
};

const g = globalThis as unknown as {
  __vb?: Session | null;
  __vbIdle?: NodeJS.Timeout;
};

export const vaultExists = () =>
  fs.access(vaultPath()).then(
    () => true,
    () => false,
  );
export const getSession = () => g.__vb ?? null;

export function requireSession(): Session {
  if (!g.__vb) throw new Locked("Vault is locked");
  g.__vb.lastActive = Date.now();
  return g.__vb;
}

function pack(salt: Buffer, wrappedKek: Buffer, body: Buffer) {
  const len = Buffer.alloc(2);
  len.writeUInt16BE(wrappedKek.length);
  return Buffer.concat([MAGIC, salt, len, wrappedKek, body]);
}

function parse(raw: Buffer) {
  if (raw.length < 26 || !raw.subarray(0, 8).equals(MAGIC)) {
    throw new UserError("This file is not a Vaultbook vault.");
  }
  const n = raw.readUInt16BE(24);
  return {
    salt: raw.subarray(8, 24),
    wrappedKek: raw.subarray(26, 26 + n),
    body: raw.subarray(26 + n),
  };
}

async function start(
  pg: PGlite,
  kek: Buffer,
  salt: Buffer,
  wrappedKek: Buffer,
): Promise<Session> {
  await migrate(pgliteExec(pg), config.migrationsDir, portableFilter); // also applies upgrades
  const db = drizzle(pg, { schema }) as unknown as Db;
  const [org] = await db.select().from(schema.organizations).limit(1);

  if (!org) throw new UserError("This vault is empty or damaged.");

  const dek = unwrapDek(kek, org.wrappedDek, org.id);
  const s: Session = {
    pg,
    db,
    kek,
    dek,
    salt,
    wrappedKek,
    orgId: org.id,
    dirty: false,
    chain: Promise.resolve(),
    lastActive: Date.now(),
    lastBackup: 0,
    id: randomBytes(8).toString("hex"),
  };
  g.__vb = s;
  if (!g.__vbIdle) {
    g.__vbIdle = setInterval(() => {
      if (g.__vb && Date.now() - g.__vb.lastActive > IDLE_MS) void lockVault();
    }, 30_000);
    g.__vbIdle.unref();
  }
  return s;
}

export async function createVault(
  password: string,
  shopName: string,
): Promise<string> {
  if (await vaultExists()) throw new UserError("A vault already exists here.");
  if (password.length < 12) throw new UserError("Use at least 12 characters.");
  if (!shopName.trim()) throw new UserError("Enter a shop name.");
  await fs.mkdir(config.dataDir, { recursive: true });

  const salt = newSalt();
  const kek = deriveKekFromPassword(password, salt);
  const recovery = randomBytes(32);
  const wrappedKek = seal(recovery, kek, "recovery");

  const pg = new PGlite(); // in memory
  await pg.waitReady;
  await migrate(pgliteExec(pg), config.migrationsDir, portableFilter);
  const orgId = randomUUID();
  const dek = newDek();
  await pg.query(
    "INSERT INTO organizations (id, name, wrapped_dek) VALUES ($1, $2, $3)",
    [orgId, shopName.trim(), wrapDek(kek, dek, orgId)],
  );
  const s = await start(pg, kek, salt, wrappedKek);
  await persist(s);
  return recovery.toString("base64url"); // show once; the owner writes it on paper
}

const failures = { n: 0, until: 0 };
export const __resetThrottleForTests = () => {
  failures.n = 0;
  failures.until = 0;
};

export async function unlockVault(password: string): Promise<Session> {
  if (Date.now() < failures.until)
    throw new UserError("Too many attempts. Wait a moment.");
  if (g.__vb) await lockVault();
  const { salt, wrappedKek, body } = parse(await fs.readFile(vaultPath()));
  const kek = deriveKekFromPassword(password, salt);
  let tar: Buffer;
  try {
    tar = open(kek, body, "vault");
  } catch {
    failures.n++;
    failures.until = Date.now() + Math.min(2 ** failures.n, 60) * 1000;
    throw new UserError("Wrong password.");
  }
  failures.n = 0;
  const pg = new PGlite({ loadDataDir: new Blob([new Uint8Array(tar)]) });
  await pg.waitReady;
  return start(pg, kek, salt, wrappedKek);
}

async function persist(s: Session) {
  const dump = Buffer.from(
    await (await s.pg.dumpDataDir("none")).arrayBuffer(),
  );
  const out = pack(s.salt, s.wrappedKek, seal(s.kek, dump, "vault"));
  const tmp = vaultPath() + ".tmp";
  const fh = await fs.open(tmp, "w");
  await fh.writeFile(out);
  await fh.sync(); // flush to the stick before renaming
  await fh.close();
  if (Date.now() - s.lastBackup > 10 * 60 * 1000) {
    await rotateBackups();
    s.lastBackup = Date.now();
  }
  await fs.rename(tmp, vaultPath()); // atomic replace
  s.dirty = false;
}

async function rotateBackups() {
  for (let i = 4; i >= 1; i--) {
    await fs
      .rename(vaultPath() + ".bak" + i, vaultPath() + ".bak" + (i + 1))
      .catch(() => {});
  }
  await fs.copyFile(vaultPath(), vaultPath() + ".bak1").catch(() => {});
}

export function markDirty() {
  const s = g.__vb;
  if (!s) return;
  s.dirty = true;
  clearTimeout(s.timer);
  s.timer = setTimeout(
    () =>
      void flush().catch((e) => console.error("vault save failed:", e.message)),
    2000,
  );
}

export function flush(): Promise<void> {
  const s = g.__vb;
  if (!s) return Promise.resolve();
  const run = s.chain.then(() => (s.dirty ? persist(s) : undefined)); // saves never overlap
  s.chain = run.catch(() => {}); // one failed save must not poison later ones
  return run;
}

export async function lockVault() {
  const s = g.__vb;
  if (!s) return;
  clearTimeout(s.timer);
  try {
    await flush();
  } finally {
    g.__vb = null;
    await s.pg.close().catch(() => {});
    s.kek.fill(0);
    s.dek.fill(0);
  }
}

/** Test helper: simulate a crash. Drops the session without saving. */
export async function __dropSessionForTests() {
  const s = g.__vb;
  if (!s) return;
  clearTimeout(s.timer);
  g.__vb = null;
  await s.pg.close().catch(() => {});
}

// Changing the password changes the KEK, so a NEW recovery code is issued; the old one stops working.
async function rekey(s: Session, newPassword: string): Promise<string> {
  if (newPassword.length < 12)
    throw new UserError("Use at least 12 characters.");
  const salt = newSalt();
  const newKek = deriveKekFromPassword(newPassword, salt);
  const recovery = randomBytes(32);
  await s.pg.query("UPDATE organizations SET wrapped_dek = $1 WHERE id = $2", [
    wrapDek(newKek, s.dek, s.orgId),
    s.orgId,
  ]);
  s.kek.fill(0);
  s.kek = newKek;
  s.salt = salt;
  s.wrappedKek = seal(recovery, newKek, "recovery");
  s.dirty = true;
  await flush();
  return recovery.toString("base64url");
}

export async function unlockWithRecovery(
  code: string,
  newPassword: string,
): Promise<string> {
  if (newPassword.length < 12)
    throw new UserError("Use at least 12 characters.");

  if (g.__vb) await lockVault();
  const { salt, wrappedKek, body } = parse(await fs.readFile(vaultPath()));
  let kek: Buffer, tar: Buffer;
  try {
    kek = open(Buffer.from(code.trim(), "base64url"), wrappedKek, "recovery");
    tar = open(kek, body, "vault");
  } catch {
    throw new UserError("That recovery code is not valid.");
  }
  const pg = new PGlite({ loadDataDir: new Blob([new Uint8Array(tar)]) });
  await pg.waitReady;
  const s = await start(pg, kek, salt, wrappedKek);
  return rekey(s, newPassword);
}

export async function changePassword(
  current: string,
  next: string,
): Promise<string> {
  const s = requireSession();
  const check = deriveKekFromPassword(current, s.salt);
  if (!timingSafeEqual(check, s.kek))
    throw new UserError("Current password is wrong.");
  return rekey(s, next);
}

export async function readVaultForBackup() {
  await flush();
  return fs.readFile(vaultPath()); // already sealed
}
