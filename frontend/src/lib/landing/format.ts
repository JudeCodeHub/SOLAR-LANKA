import { messages } from "../../messages/index.ts";

/** "Colombo, Gampaha, Kalutara" for a list of districts, or an empty string for none. */
export function formatList(values: readonly string[]): string {
  return values.join(", ");
}

/** The display name of a service code; an unknown code is shown as written, never dropped. */
export function serviceLabel(code: string): string {
  const labels: Record<string, string> = messages.services;
  return labels[code] ?? code;
}

/** "Brand Model", the name a product is known by. */
export function productName(product: { brand: string; model: string }): string {
  return `${product.brand} ${product.model}`.trim();
}
