/** Product edit forms: which fields exist, what each accepts, and the exact change request that is sent. */
import { messages } from "../../messages/index.ts";

const text = messages.adminCatalogue.errors;

export interface DecimalRule {
  min: number;
  /** Whether the minimum itself is allowed. */
  inclusive: boolean;
  max?: number;
}

export interface FieldDef {
  key: string;
  kind: "decimal" | "int" | "text" | "longtext" | "category";
  rule?: DecimalRule;
  max?: number;
}

const POSITIVE: DecimalRule = { min: 0, inclusive: false };
const NON_NEGATIVE: DecimalRule = { min: 0, inclusive: true };

export const PANEL_FIELDS: readonly FieldDef[] = [
  { key: "wattage_w", kind: "decimal", rule: POSITIVE },
  { key: "efficiency_percent", kind: "decimal", rule: { min: 0, inclusive: false, max: 100 } },
  { key: "cell_type", kind: "text", max: 200 },
  { key: "voltage_at_max_power_v", kind: "decimal", rule: POSITIVE },
  { key: "open_circuit_voltage_v", kind: "decimal", rule: POSITIVE },
  { key: "current_at_max_power_a", kind: "decimal", rule: POSITIVE },
  { key: "short_circuit_current_a", kind: "decimal", rule: POSITIVE },
  { key: "product_warranty_years", kind: "decimal", rule: NON_NEGATIVE },
  { key: "performance_warranty_years", kind: "decimal", rule: NON_NEGATIVE },
  { key: "warranty_details", kind: "longtext", max: 2000 },
  { key: "country_of_manufacture", kind: "text", max: 200 },
];

export const INVERTER_FIELDS: readonly FieldDef[] = [
  { key: "category", kind: "category" },
  { key: "capacity_kw", kind: "decimal", rule: POSITIVE },
  { key: "mppt_count", kind: "int", rule: NON_NEGATIVE },
  { key: "warranty_years", kind: "decimal", rule: NON_NEGATIVE },
  { key: "warranty_details", kind: "longtext", max: 2000 },
  { key: "compatibility_notes", kind: "longtext", max: 4000 },
  { key: "compatibility_source_url", kind: "text", max: 2000 },
];

export type Values = Record<string, string>;

/** The form's starting values from a stored specification; an unknown value starts empty. */
export function toValues(specs: Record<string, unknown>, fields: readonly FieldDef[]): Values {
  return Object.fromEntries(fields.map((field) => [field.key, specs[field.key] === null || specs[field.key] === undefined ? "" : String(specs[field.key])]));
}

const NUMBER = /^\d+(\.\d+)?$/;

function fieldError(field: FieldDef, raw: string): string | null {
  const value = raw.trim();
  if (value === "") return null;
  if (field.kind === "decimal" || field.kind === "int") {
    if (!NUMBER.test(value) || (field.kind === "int" && value.includes("."))) return text.number;
    const n = Number(value);
    const rule = field.rule;
    if (rule && (n < rule.min || (!rule.inclusive && n === rule.min))) return rule.inclusive ? text.nonNegative : text.positive;
    if (rule?.max !== undefined && n > rule.max) return text.atMost.replace("{max}", String(rule.max));
    return null;
  }
  if (field.max !== undefined && value.length > field.max) return text.tooLong.replace("{max}", String(field.max));
  return null;
}

/** Problems by field key for the entered values; empty when they can be sent. */
export function validateSpecs(fields: readonly FieldDef[], values: Values, original: Values): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    // Only changed fields are sent, so only they are checked.
    if ((values[field.key] ?? "").trim() === (original[field.key] ?? "").trim()) continue;
    const problem = fieldError(field, values[field.key] ?? "");
    if (problem) errors[field.key] = problem;
  }
  const notes = (values.compatibility_notes ?? "").trim();
  const source = (values.compatibility_source_url ?? "").trim();
  if ("compatibility_notes" in values && notes !== "" && source === "" && !errors.compatibility_source_url) errors.compatibility_source_url = text.sourceRequired;
  return errors;
}

/** The change request: only fields that differ, an emptied field sent as null, numbers as the backend's decimals. */
export function specChanges(fields: readonly FieldDef[], values: Values, original: Values): Record<string, string | number | null> {
  const body: Record<string, string | number | null> = {};
  for (const field of fields) {
    const now = (values[field.key] ?? "").trim();
    if (now === (original[field.key] ?? "").trim()) continue;
    body[field.key] = now === "" ? null : field.kind === "int" ? Number(now) : now;
  }
  return body;
}

/** Brand and model are required and sent only when changed. */
export function validateNames(values: Values, original: Values): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of ["brand", "model"]) {
    const now = (values[key] ?? "").trim();
    if (now === (original[key] ?? "").trim()) continue;
    if (now === "") errors[key] = text.required;
    else if (now.length > 200) errors[key] = text.tooLong.replace("{max}", "200");
  }
  return errors;
}

export function nameChanges(values: Values, original: Values): Record<string, string> {
  const body: Record<string, string> = {};
  for (const key of ["brand", "model"]) {
    const now = (values[key] ?? "").trim();
    if (now !== (original[key] ?? "").trim()) body[key] = now;
  }
  return body;
}
