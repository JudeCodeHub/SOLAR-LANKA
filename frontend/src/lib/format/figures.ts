/** The one place money and units are written, so LKR, kWh and kWp always look the same. */
const MONEY = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;
const QUANTITY = { minimumFractionDigits: 0, maximumFractionDigits: 2 } as const;

const number = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** "LKR 450,000.00": the currency code, a space, then two decimals; null when there is no usable number. */
export function formatAmount(value: string | number | null | undefined, currency: string = "LKR"): string | null {
  const parsed = number(value);
  if (parsed === null) return null;
  return `${currency} ${new Intl.NumberFormat("en-GB", MONEY).format(parsed)}`.trim();
}

const unitOf = (unit: string) => (value: string | number | null | undefined): string | null => {
  const parsed = number(value);
  return parsed === null ? null : `${new Intl.NumberFormat("en-GB", QUANTITY).format(parsed)} ${unit}`;
};

/** "5.45 kWp": a panel array's rated size. */
export const formatKwp = unitOf("kWp");
/** "5.4 kW": a power rating. */
export const formatKw = unitOf("kW");
/** "7,800 kWh": energy. */
export const formatKwh = unitOf("kWh");
