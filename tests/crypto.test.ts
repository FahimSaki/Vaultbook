import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { seal, open } from "@/server/crypto/aead";
import {
  deriveKekFromPassword,
  newSalt,
  newDek,
  wrapDek,
  unwrapDek,
  encryptCost,
  decryptCost,
} from "@/server/crypto/keys";

const key = () => randomBytes(32);

describe("aead", () => {
  it("round-trips", () => {
    const k = key();
    expect(open(k, seal(k, Buffer.from("hello"), "a"), "a").toString()).toBe(
      "hello",
    );
  });
  it("detects tampering", () => {
    const k = key();
    const blob = seal(k, Buffer.from("hello"), "a");
    blob[blob.length - 1] ^= 1;
    expect(() => open(k, blob, "a")).toThrow();
  });
  it("rejects the wrong key and the wrong AAD", () => {
    const k = key();
    const blob = seal(k, Buffer.from("hello"), "a");
    expect(() => open(key(), blob, "a")).toThrow();
    expect(() => open(k, blob, "b")).toThrow();
  });
  it("rejects an unknown version", () => {
    const k = key();
    const blob = seal(k, Buffer.from("x"), "a");
    blob[0] = 9;
    expect(() => open(k, blob, "a")).toThrow();
  });
});

describe("keys", () => {
  it("derives deterministically per salt", () => {
    const s = newSalt();
    expect(
      deriveKekFromPassword("correct horse", s).equals(
        deriveKekFromPassword("correct horse", s),
      ),
    ).toBe(true);
    expect(
      deriveKekFromPassword("correct horse", s).equals(
        deriveKekFromPassword("correct horsf", s),
      ),
    ).toBe(false);
    expect(
      deriveKekFromPassword("correct horse", s).equals(
        deriveKekFromPassword("correct horse", newSalt()),
      ),
    ).toBe(false);
  });
  it("binds a wrapped DEK to its org", () => {
    const kek = key(),
      dek = newDek();
    const w = wrapDek(kek, dek, "org1");
    expect(unwrapDek(kek, w, "org1").equals(dek)).toBe(true);
    expect(() => unwrapDek(kek, w, "org2")).toThrow();
  });
  it("binds a cost to its product", () => {
    const dek = newDek();
    const blob = encryptCost(dek, "o", "p1", 12345);
    expect(decryptCost(dek, "o", "p1", blob)).toBe(12345);
    expect(() => decryptCost(dek, "o", "p2", blob)).toThrow();
  });
});
