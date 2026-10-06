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

const LEARN_PHOTOS = ["learnHow", "learnPanels", "learnDatasheet", "learnGrid", "learnBill", "learnCleaning", "learnTechnician"] as const;
export type LearnPhoto = (typeof LEARN_PHOTOS)[number];

/** The photo for a guide: matched on words in its address, otherwise taken in turn from the set so neighbours differ. */
export function articlePhoto(slug: string, position: number): LearnPhoto {
  const rules: [RegExp, LearnPhoto][] = [
    [/datasheet|specification/, "learnDatasheet"],
    [/net-meter|grid|connection|scheme/, "learnGrid"],
    [/bill|tariff|electricity/, "learnBill"],
    [/clean|maintenance/, "learnCleaning"],
    [/technician|error|fault|safety/, "learnTechnician"],
    [/inverter|panel/, "learnPanels"],
    [/how|work|basic|start/, "learnHow"],
  ];
  const match = rules.find(([pattern]) => pattern.test(slug));
  return match ? match[1] : LEARN_PHOTOS[position % 3]!;
}
