/**
 * Company offers: the commercial side of a catalogue product (a price, a sample-price label and the
 * company's own claim). Pure functions, so the rules are tested without a browser.
 *
 * An offer holds only these commercial fields. The product's specifications belong to the catalogue
 * and never appear in an offer's form or in what is sent, so a company's price can never alter, or
 * be mistaken for, canonical product data.
 */
import { z } from "zod";

import { format, messages } from "../../messages/index.ts";
import { optionalDecimal } from "../estimator/schema.ts";
import { formatDecimal } from "../catalogue/params.ts";

export const MAX_CLAIM = 2000;
export const DEFAULT_CURRENCY = "LKR";
/** The only fields an offer can carry. Anything else (a specification) is never sent. */
export const OFFER_FIELDS = ["indicative_price", "currency", "is_demo_price", "company_claim"] as const;

const text = messages.company.offers.validation;

export const offerSchema = z
  .object({
    price: optionalDecimal(1_000_000_000_000, 2),
    currency: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase()),
    is_demo_price: z.boolean(),
    company_claim: z.string().trim().max(MAX_CLAIM),
  })
  .superRefine((value, context) => {
    // A price needs a currency (and the backend refuses one without the other).
    if (value.price !== null && !/^[A-Z]{3}$/.test(value.currency)) {
      context.addIssue({ code: "custom", path: ["currency"], message: text.currency });
    }
  })
  .transform((value) => ({
    indicative_price: value.price,
    // No price means no currency: the two are always given or cleared together.
    currency: value.price === null ? null : value.currency,
    is_demo_price: value.is_demo_price,
    company_claim: value.company_claim === "" ? null : value.company_claim,
  }));

export type OfferValues = z.output<typeof offerSchema>;

export interface OfferLike {
  indicative_price: string | null;
  currency: string | null;
  is_demo_price: boolean;
  company_claim: string | null;
}

export interface OfferFormValues {
  price: string;
  currency: string;
  is_demo_price: boolean;
  company_claim: string;
}

export const emptyOfferForm: OfferFormValues = {
  price: "",
  currency: DEFAULT_CURRENCY,
  is_demo_price: false,
  company_claim: "",
};

export function valuesFromOffer(offer: OfferLike): OfferFormValues {
  return {
    price: offer.indicative_price ?? "",
    currency: offer.currency ?? DEFAULT_CURRENCY,
    is_demo_price: offer.is_demo_price,
    company_claim: offer.company_claim ?? "",
  };
}

export type OfferChanges = Partial<OfferValues>;

/**
 * Only what really changed. The price and currency travel together (the backend requires both or
 * neither), and an unchanged price is not re-sent just because it was written as 1000 instead of
 * 1000.00.
 */
export function offerChanges(server: OfferLike, values: OfferValues): OfferChanges {
  const changes: OfferChanges = {};
  const samePrice =
    server.indicative_price === null || values.indicative_price === null
      ? server.indicative_price === values.indicative_price
      : Number(server.indicative_price) === Number(values.indicative_price) && server.currency === values.currency;
  if (!samePrice) {
    changes.indicative_price = values.indicative_price;
    changes.currency = values.currency;
  }
  if (server.is_demo_price !== values.is_demo_price) changes.is_demo_price = values.is_demo_price;
  if ((server.company_claim ?? "") !== (values.company_claim ?? "")) changes.company_claim = values.company_claim;
  return changes;
}

export const hasChanges = (changes: OfferChanges) => Object.keys(changes).length > 0;

/** The body for a new offer: the chosen product plus the commercial fields, nothing else. */
export function createBody(productId: string, values: OfferValues) {
  return {
    product_id: productId,
    indicative_price: values.indicative_price,
    currency: values.currency,
    is_demo_price: values.is_demo_price,
    company_claim: values.company_claim,
  };
}

interface SpecSource {
  kind: "panel" | "inverter";
  specifications: unknown;
}

const card = messages.catalogue.card;
const typeNames: Record<string, string> = messages.catalogue.filters.typeOptions;

/**
 * A short, read-only line of the product's catalogue specifications (power and efficiency for a
 * panel, type and capacity for an inverter). An unknown value reads Not specified, never zero.
 */
export function specLine(product: SpecSource): string {
  const specs = (product.specifications ?? {}) as Record<string, string | null | undefined>;
  const value = (key: string, unit: (v: string) => string) => {
    const shown = formatDecimal(specs[key] ?? null);
    return shown === null ? card.unspecified : unit(shown);
  };
  if (product.kind === "panel") {
    return `${value("wattage_w", (v) => format(card.units.w, { value: v }))} · ${value("efficiency_percent", (v) => format(card.units.percent, { value: v }))}`;
  }
  const category = specs.category;
  const type = category ? (typeNames[category] ?? category) : card.unspecified;
  return `${type} · ${value("capacity_kw", (v) => format(card.units.kw, { value: v }))}`;
}
