/** How a customer reads their offers: state and expiry, what is included, and side-by-side rows with differences. */
import { format, messages } from "../../messages/index.ts";
import { formatAmount } from "../format/figures.ts";
import { formatDate } from "../format/datetime.ts";

const text = messages.customerOffers;
const DAY = 86_400_000;
/** An active offer with this many days or fewer left is called out as expiring soon. */
export const SOON_DAYS = 3;

export interface OfferLike {
  status: string;
  valid_until: string | null;
}

export type OfferState = "active" | "expired" | "accepted" | "declined" | "withdrawn" | "replaced" | "draft";

/** A sent offer past its valid-until time is expired even if its stored status still says sent. */
export function offerState(offer: OfferLike, now: number): OfferState {
  if (offer.status === "sent") {
    return offer.valid_until !== null && Date.parse(offer.valid_until) <= now ? "expired" : "active";
  }
  if (offer.status === "expired") return "expired";
  if (offer.status === "accepted") return "accepted";
  if (offer.status === "declined") return "declined";
  if (offer.status === "withdrawn") return "withdrawn";
  if (offer.status === "revised") return "replaced";
  return "draft";
}

/** Whole days left until the offer ends, rounding up; negative once it has ended. */
export function daysLeft(validUntil: string, now: number): number {
  return Math.ceil((Date.parse(validUntil) - now) / DAY);
}

export function isExpiringSoon(offer: OfferLike, now: number): boolean {
  if (offerState(offer, now) !== "active" || offer.valid_until === null) return false;
  return daysLeft(offer.valid_until, now) <= SOON_DAYS;
}

const longDate = (iso: string) => formatDate(iso, "UTC");

/** The expiry in words: when it ends and how long is left, or when it ended. */
export function expiryText(offer: OfferLike, now: number): string {
  if (offer.valid_until === null) return text.expiry.none;
  const state = offerState(offer, now);
  const date = longDate(offer.valid_until);
  if (state === "expired") return format(text.expiry.expiredOn, { date });
  if (state !== "active") return format(text.expiry.wasValidUntil, { date });
  const left = daysLeft(offer.valid_until, now);
  if (left <= 1) return format(text.expiry.lastDay, { date });
  return format(text.expiry.validUntil, { date, days: left });
}

export type OfferTone = "success" | "warning" | "neutral" | "info";

/** The colour family for an offer's state chip; the word always says the same thing, so colour never carries it alone. */
export function stateTone(state: OfferState): OfferTone {
  if (state === "active" || state === "accepted") return "success";
  if (state === "expired") return "warning";
  if (state === "draft") return "info";
  return "neutral";
}

export function stateLabel(state: OfferState): string {
  return (text.states as Record<string, string>)[state] ?? state;
}

export const INCLUSION_KEYS = [
  "panel_equipment",
  "inverter_equipment",
  "installation_labour",
  "permits",
  "grid_connection",
  "monitoring",
  "maintenance",
] as const;
export type InclusionKey = (typeof INCLUSION_KEYS)[number];
export type InclusionStatus = "included" | "excluded" | "not_specified";

export interface LineLike {
  kind: string;
  product_snapshot?: unknown;
}

/**
 * What the quotation itself shows as included. Panels and inverters count as included only when an
 * equipment line for them exists; everything else the quotation does not state is NOT SPECIFIED,
 * which is different from excluded, so the customer is told to ask rather than assume.
 */
export function inclusionsFromLines(lines: readonly LineLike[]): Record<InclusionKey, InclusionStatus> {
  const kinds = new Set<string>();
  for (const line of lines) {
    if (line.kind !== "equipment") continue;
    const kind = (line.product_snapshot as { kind?: string } | null | undefined)?.kind;
    if (kind === "panel" || kind === "inverter") kinds.add(kind);
  }
  return {
    panel_equipment: kinds.has("panel") ? "included" : "not_specified",
    inverter_equipment: kinds.has("inverter") ? "included" : "not_specified",
    installation_labour: "not_specified",
    permits: "not_specified",
    grid_connection: "not_specified",
    monitoring: "not_specified",
    maintenance: "not_specified",
  };
}

export function inclusionLabel(key: InclusionKey): string {
  return text.inclusions.names[key];
}

export interface ComparisonOfferLike {
  quotation_id: string;
  company_id: string;
  sent_at: string;
  valid_until: string;
  total_lkr: string | null;
  capacity_kwp: string | null;
  warranty_terms: string | null;
  exclusions: string | null;
  equipment: readonly { kind: string | null; brand: string | null; model: string | null; description: string; quantity: string }[];
  inclusions: Record<InclusionKey, InclusionStatus>;
  missing_fields: readonly string[];
}

export type Cell =
  | { kind: "value"; text: string }
  | { kind: "included" }
  | { kind: "excluded" }
  | { kind: "unspecified" };

export interface Row {
  id: string;
  label: string;
  cells: Cell[];
  /** The offers do not all say the same thing. */
  differs: boolean;
  /** At least one offer does not say. */
  someUnspecified: boolean;
}

const same = (a: Cell, b: Cell) => a.kind === b.kind && (a.kind !== "value" || (b.kind === "value" && a.text === b.text));
const trimZeros = (value: string) => (value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value);
const money = (value: string) => formatAmount(value) ?? "";

function row(id: string, label: string, cells: Cell[]): Row {
  return {
    id,
    label,
    cells,
    differs: cells.some((cell) => !same(cell, cells[0] as Cell)),
    someUnspecified: cells.some((cell) => cell.kind === "unspecified"),
  };
}

const valueOrUnspecified = (value: string | null, render: (v: string) => string = (v) => v): Cell =>
  value === null || value.trim() === "" ? { kind: "unspecified" } : { kind: "value", text: render(value) };

function equipmentCell(offer: ComparisonOfferLike, kind: "panel" | "inverter"): Cell {
  const lines = offer.equipment.filter((item) => item.kind === kind);
  if (lines.length === 0) return { kind: "unspecified" };
  return {
    kind: "value",
    text: lines
      .map((item) => format(text.compare.equipmentLine, { quantity: trimZeros(item.quantity), name: `${item.brand ?? ""} ${item.model ?? item.description}`.trim() }))
      .join("; "),
  };
}

/** Comparison rows for the offers, in a fixed order, each marked when the offers differ or some do not say. */
export function compareRows(offers: readonly ComparisonOfferLike[], now: number): Row[] {
  if (offers.length === 0) return [];
  const labels = text.compare.rows;
  const rows: Row[] = [
    row("total", labels.total, offers.map((o) => valueOrUnspecified(o.total_lkr, money))),
    row(
      "valid_until",
      labels.validUntil,
      offers.map((o) => ({ kind: "value", text: expiryText({ status: "sent", valid_until: o.valid_until }, now) }) as Cell),
    ),
    row("sent", labels.sent, offers.map((o) => ({ kind: "value", text: longDate(o.sent_at) }) as Cell)),
    row("capacity", labels.capacity, offers.map((o) => valueOrUnspecified(o.capacity_kwp, (v) => format(text.compare.kwp, { value: trimZeros(v) })))),
    row("panels", labels.panels, offers.map((o) => equipmentCell(o, "panel"))),
    row("inverters", labels.inverters, offers.map((o) => equipmentCell(o, "inverter"))),
    row("warranty", labels.warranty, offers.map((o) => valueOrUnspecified(o.warranty_terms))),
    row("exclusions", labels.exclusions, offers.map((o) => valueOrUnspecified(o.exclusions))),
  ];
  for (const key of INCLUSION_KEYS) {
    rows.push(
      row(
        key,
        inclusionLabel(key),
        offers.map((o) => {
          const status = o.inclusions[key];
          return status === "included" ? { kind: "included" } : status === "excluded" ? { kind: "excluded" } : { kind: "unspecified" };
        }),
      ),
    );
  }
  rows.push(
    row(
      "missing",
      labels.missing,
      offers.map((o) => ({
        kind: "value",
        text: o.missing_fields.length === 0 ? text.compare.nothingMissing : o.missing_fields.map((name) => (text.compare.fieldNames as Record<string, string>)[name] ?? name).join(", "),
      })) as Cell[],
    ),
  );
  return rows;
}

/** The text for a cell, never blank: an unstated item always says Not specified. */
export function cellText(cell: Cell): string {
  switch (cell.kind) {
    case "value":
      return cell.text;
    case "included":
      return text.inclusions.included;
    case "excluded":
      return text.inclusions.excluded;
    default:
      return text.inclusions.notSpecified;
  }
}
