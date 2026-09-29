import Decimal from "decimal.js";

/**
 * Display only — never put the result back into an input that is sent to the API. Thousands are
 * grouped and whole amounts drop their decimals: 45000 → "45,000", 642.857 → "642.86".
 */
export function formatAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const [whole, fraction] = new Decimal(value).toFixed(2).split(".");
  const negative = whole.startsWith("-");
  const digits = negative ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}${fraction === "00" ? "" : `.${fraction}`}`;
}

/** Display only: a quantity without its trailing zeros, 2.5000 → "2.5", 0.125 → "0.125". */
export function formatQuantity(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return new Decimal(value).toFixed(4).replace(/\.?0+$/, "");
}

export function marginPercent(retail: string, cost: string) {
  if (!retail || !cost) {
    return null;
  }
  const price = new Decimal(retail);
  if (price.isZero()) {
    return null;
  }
  return price.minus(cost).div(price).times(100).toFixed(1);
}

export function profitPerUnit(retail: string, cost: string) {
  if (!retail || !cost) {
    return null;
  }
  return new Decimal(retail).minus(cost).toFixed(2);
}

export function addQuantities(values: Array<string | number | undefined>) {
  return values.reduce((sum, value) => sum.plus(value ?? 0), new Decimal(0)).toFixed(4).replace(/\.?0+$/, "");
}

/** Quantity-weighted average of stock-balance costs. */
export function weightedAverageCost(
  rows: Array<{ quantity?: number; averageCost?: number | null }>,
) {
  let qty = new Decimal(0);
  let value = new Decimal(0);
  for (const row of rows) {
    const q = new Decimal(row.quantity ?? 0);
    // The backend redacts costs for cashier/packer sessions with null.
    if (q.lte(0) || row.averageCost == null) {
      continue;
    }
    qty = qty.plus(q);
    value = value.plus(q.times(row.averageCost));
  }
  if (qty.isZero()) {
    return null;
  }
  return value.div(qty).toFixed(2);
}
