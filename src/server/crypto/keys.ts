import { scryptSync, randomBytes } from "node:crypto";
import { seal, open } from "./aead";

export const newSalt = () => randomBytes(16);
export const newDek = () => randomBytes(32);

export function deriveKekFromPassword(password: string, salt: Buffer): Buffer {
  return scryptSync(password.normalize("NFKC"), salt, 32, {
    N: 2 ** 17,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
}

export const wrapDek = (kek: Buffer, dek: Buffer, orgId: string) =>
  seal(kek, dek, "dek:" + orgId);
export const unwrapDek = (kek: Buffer, wrapped: Buffer, orgId: string) =>
  open(kek, wrapped, "dek:" + orgId);

export const encryptCost = (
  dek: Buffer,
  orgId: string,
  productId: string,
  cents: number,
) => seal(dek, Buffer.from(String(cents)), `cost:${orgId}:${productId}`);
export const decryptCost = (
  dek: Buffer,
  orgId: string,
  productId: string,
  blob: Buffer,
) => Number(open(dek, blob, `cost:${orgId}:${productId}`).toString());
