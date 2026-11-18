import { describe, it, expect } from "vitest";
import { toCents } from "@/lib/money";

describe("toCents", () => {
  it("parses valid amounts", () => {
    expect(toCents("12")).toBe(1200);
    expect(toCents("12.5")).toBe(1250);
    expect(toCents("12.50")).toBe(1250);
    expect(toCents("12,5")).toBe(1250);
  });
  it("rejects invalid amounts", () => {
    for (const bad of ["abc", "1.234", "-5", ".5", ""]) {
      expect(() => toCents(bad)).toThrow();
    }
  });
});
