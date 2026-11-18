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

export const formatMoney = (cents: number, currency = "BDT") =>
  new Intl.NumberFormat("en-BD", { style: "currency", currency }).format(
    cents / 100,
  );
