import { UserError } from "./errors";

export const DEFAULT_CURRENCY = "BDT";
export const COMMON_CURRENCIES = [
  "BDT",
  "USD",
  "EUR",
  "GBP",
  "INR",
  "AED",
  "SAR",
  "SGD",
  "MYR",
  "JPY",
  "CNY",
];

const KNOWN = new Set<string>(Intl.supportedValuesOf("currency"));

/** Blank means "not set" and falls back to BDT. Anything else must be a real ISO 4217 code. */
export function normalizeCurrency(input?: string | null): string {
  const c = (input ?? "").trim().toUpperCase();
  if (!c) return DEFAULT_CURRENCY;
  if (!/^[A-Z]{3}$/.test(c) || !KNOWN.has(c)) {
    throw new UserError(
      "Unknown currency code. Use a 3-letter code such as BDT or USD.",
    );
  }
  return c;
}

export function toCents(input: string): number {
  const [whole, frac = ""] = input.trim().replace(",", ".").split(".");
  if (
    !/^[0-9]+$/.test(whole) ||
    frac.length > 2 ||
    (frac && !/^[0-9]+$/.test(frac))
  ) {
    throw new Error("Invalid amount");
  }
  return Number(whole) * 100 + Number(frac.padEnd(2, "0") || "0");
}

// Every currency is stored x100 and shown with 2 decimals, so JPY etc. stay consistent.
export const formatMoney = (
  cents: number,
  currency: string = DEFAULT_CURRENCY,
) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
