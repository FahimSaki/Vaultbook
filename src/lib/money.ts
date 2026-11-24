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

export const MAX_CENTS = 2_147_483_647;

export function toCents(input: string): number {
  const [whole, frac = ""] = input.trim().replace(",", ".").split(".");
  if (
    !/^[0-9]+$/.test(whole) ||
    frac.length > 2 ||
    (frac && !/^[0-9]+$/.test(frac))
  ) {
    throw new UserError("Enter an amount like 12 or 12.50.");
  }

  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0") || "0");
  if (cents > MAX_CENTS) throw new UserError("That amount is too large.");
  return cents;
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
