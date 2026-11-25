import { config } from "../config";

/** Hosted editions: the KEK is MASTER_KEY, 32 random bytes, base64. */
export function masterKey(): Buffer {
  const k = Buffer.from(config.masterKey ?? "", "base64");
  if (k.length !== 32)
    throw new Error("MASTER_KEY must be 32 bytes, base64 encoded");
  return k;
}
