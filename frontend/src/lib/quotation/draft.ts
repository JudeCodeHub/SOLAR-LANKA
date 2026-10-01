/** Rules for the quotation draft form: validation, the request it produces, and reopening a saved draft. */
import { z } from "zod";

import { messages } from "../../messages/index.ts";
import { optionalDecimal } from "../estimator/schema.ts";

const text = messages.company.quotation.validation;

export const MAX_LINES = 50;
export const LINE_KINDS = ["equipment", "charge"] as const;
export const DISCOUNT_KINDS = ["none", "fixed", "percent"] as const;
export type LineKind = (typeof LINE_KINDS)[number];
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

/** A plain decimal that must be given, within a maximum and a number of places. */
function required(places: number, maxValue: number, { positive = false } = {}) {
  return z
    .string()
    .trim()
    .superRefine((value, context) => {
      if (value === "") return context.addIssue({ code: "custom", message: text.required });
      if (!/^\d+(\.\d+)?$/.test(value) || value.length > 16) return context.addIssue({ code: "custom", message: text.decimal });
      if ((value.split(".")[1]?.length ?? 0) > places) return context.addIssue({ code: "custom", message: text.places });
      if (positive && !(Number(value) > 0)) return context.addIssue({ code: "custom", message: text.positive });
      if (Number(value) > maxValue) return context.addIssue({ code: "custom", message: text.tooBig });
    });
}

/** A decimal that may be left blank (it then counts as zero, with the places the server uses). */
function blankIsZero(places: number, maxValue: number) {
  const inner = required(places, maxValue);
  return z
    .string()
    .trim()
    .transform((value, context) => {
      if (value === "") return (0).toFixed(places);
      const result = inner.safeParse(value);
      if (!result.success) {
        for (const issue of result.error.issues) context.addIssue({ code: "custom", message: issue.message });
        return z.NEVER;
      }
      return result.data;
    });
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const line = z
  .object({
    kind: z.enum(LINE_KINDS),
    product_id: z.string(),
    description: z.string().trim().min(1, text.required).max(500),
    quantity: required(3, 1_000_000_000, { positive: true }),
    unit_price: required(2, 1_000_000_000_000),
  })
  .superRefine((value, context) => {
    // Equipment must name a catalogue product; a charge never does.
    if (value.kind === "equipment" && value.product_id === "") {
      context.addIssue({ code: "custom", path: ["product_id"], message: text.product });
    }
  })
  .transform((value) => ({
    kind: value.kind,
    product_id: value.kind === "equipment" ? value.product_id : null,
    description: value.description,
    quantity: value.quantity,
    unit_price: value.unit_price,
  }));

export const draftSchema = z
  .object({
    lines: z.array(line).min(1, text.lines).max(MAX_LINES),
    discount_kind: z.enum(DISCOUNT_KINDS),
    discount_value: blankIsZero(2, 1_000_000_000_000),
    tax_rate_percent: blankIsZero(2, 100),
    capacity_kwp: optionalDecimal(1_000_000, 3),
    warranty_terms: optionalText(2000),
    exclusions: optionalText(2000),
    validity_days: z
      .string()
      .trim()
      .transform((value, context) => {
        if (value === "") return null;
        if (!/^\d{1,3}$/.test(value) || Number(value) < 1 || Number(value) > 90) {
          context.addIssue({ code: "custom", message: text.validity });
          return z.NEVER;
        }
        return Number(value);
      }),
    notes: optionalText(4000),
  })
  .superRefine((value, context) => {
    if (value.discount_kind === "none" && Number(value.discount_value) !== 0) {
      context.addIssue({ code: "custom", path: ["discount_value"], message: text.noDiscount });
    }
    if (value.discount_kind === "percent" && Number(value.discount_value) > 100) {
      context.addIssue({ code: "custom", path: ["discount_value"], message: text.percent });
    }
  })
  .transform((value) => ({
    lines: value.lines,
    discount_kind: value.discount_kind,
    discount_value: value.discount_kind === "none" ? "0.00" : value.discount_value,
    tax_rate_percent: value.tax_rate_percent,
    capacity_kwp: value.capacity_kwp,
    warranty_terms: value.warranty_terms,
    exclusions: value.exclusions,
    validity_days: value.validity_days,
    notes: value.notes,
  }));

export type DraftPayload = z.output<typeof draftSchema>;

export interface LineValues {
  kind: LineKind;
  product_id: string;
  description: string;
  quantity: string;
  unit_price: string;
}
export interface DraftValues {
  lines: LineValues[];
  discount_kind: DiscountKind;
  discount_value: string;
  tax_rate_percent: string;
  capacity_kwp: string;
  warranty_terms: string;
  exclusions: string;
  validity_days: string;
  notes: string;
}

export const blankLine: LineValues = { kind: "equipment", product_id: "", description: "", quantity: "1", unit_price: "" };

export const emptyDraft: DraftValues = {
  lines: [blankLine],
  discount_kind: "none",
  discount_value: "",
  tax_rate_percent: "",
  capacity_kwp: "",
  warranty_terms: "",
  exclusions: "",
  validity_days: "",
  notes: "",
};

export interface TermsView {
  lines: { kind: LineKind; product_id: string | null; description: string; quantity: string; unit_price: string; line_total: string | null }[];
  discount_kind: DiscountKind;
  discount_value: string;
  tax_rate_percent: string;
  capacity_kwp: string | null;
  warranty_terms: string | null;
  exclusions: string | null;
  validity_days: number | null;
  notes: string | null;
  subtotal: string | null;
  discount: string | null;
  tax: string | null;
  total: string | null;
}

/** "2.000" reads as 2 and "5.250" as 5.25; money keeps its two places. */
const trimZeros = (value: string) => (value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value);

/** The form's values for a saved draft; a draft with no lines yet starts with one blank line. */
export function valuesFromTerms(terms: TermsView): DraftValues {
  return {
    lines: terms.lines.length
      ? terms.lines.map((entry) => ({
          kind: entry.kind,
          product_id: entry.product_id ?? "",
          description: entry.description,
          quantity: trimZeros(entry.quantity),
          unit_price: entry.unit_price,
        }))
      : [blankLine],
    discount_kind: terms.discount_kind,
    discount_value: terms.discount_kind === "none" ? "" : terms.discount_value,
    tax_rate_percent: Number(terms.tax_rate_percent) === 0 ? "" : terms.tax_rate_percent,
    capacity_kwp: terms.capacity_kwp ? trimZeros(terms.capacity_kwp) : "",
    warranty_terms: terms.warranty_terms ?? "",
    exclusions: terms.exclusions ?? "",
    validity_days: terms.validity_days === null ? "" : String(terms.validity_days),
    notes: terms.notes ?? "",
  };
}

/** A comparable form of the values, or null when they are not valid yet. */
export function payloadKey(values: DraftValues): string | null {
  const result = draftSchema.safeParse(values);
  return result.success ? JSON.stringify(result.data) : null;
}

/** True when the form differs from the saved draft (invalid input always counts as changed). */
export function isDirty(saved: TermsView, current: DraftValues): boolean {
  const key = payloadKey(current);
  return key === null || key !== payloadKey(valuesFromTerms(saved));
}

export type Missing = "lines" | "capacity_kwp" | "warranty_terms" | "exclusions" | "validity_days";

/** What a saved draft still lacks before it can be sent (sending itself is a later step). */
export function missingForSending(terms: TermsView): Missing[] {
  const missing: Missing[] = [];
  if (terms.lines.length === 0) missing.push("lines");
  if (!terms.capacity_kwp) missing.push("capacity_kwp");
  if (!terms.warranty_terms) missing.push("warranty_terms");
  if (!terms.exclusions) missing.push("exclusions");
  if (terms.validity_days === null) missing.push("validity_days");
  return missing;
}

/** Money as the server returned it, with a thousands separator: "265.61" becomes "LKR 265.61". */
export function formatMoney(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `LKR ${new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number)}`;
}
