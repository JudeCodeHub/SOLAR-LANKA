/**
 * What a product detail page shows, as pure functions with no React imports so every rule can be
 * unit tested: specification rows with explicit units, links that are safe to open, the source
 * and verification date, and price formatting.
 *
 * The central rule: a value the catalogue does not hold is reported as unspecified (null here,
 * "Not specified" on screen). It is never turned into zero, an empty cell, or a guess. A real zero
 * (for example a warranty of 0 years) stays a zero.
 */
import { format, messages, plural } from "../../messages/index.ts";
import type { components } from "../api/schema.d.ts";
import { formatDecimal } from "./params.ts";

export type ProductDetail = components["schemas"]["ProductDetail"];
export type PublicProductOffer = components["schemas"]["PublicProductOffer"];
type PanelSpecs = components["schemas"]["PanelSpecifications"];
type InverterSpecs = components["schemas"]["InverterSpecifications"];

const text = messages.detail.specs;

export interface SpecRow {
  key: string;
  label: string;
  /** The value with its unit, or null when the catalogue does not hold it. */
  value: string | null;
}

export interface SpecGroup {
  id: string;
  title: string;
  rows: SpecRow[];
  /** Shown under the group when relevant, e.g. the compatibility caution. */
  note?: string;
}

function measured(template: string, value: string | null | undefined): string | null {
  const shown = formatDecimal(value);
  return shown === null ? null : format(template, { value: shown });
}

function years(value: string | null | undefined): string | null {
  const shown = formatDecimal(value);
  return shown === null ? null : format(plural(text.units.years, Number(shown)), { value: shown });
}

function words(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function list(values: readonly string[] | null | undefined): string | null {
  const kept = (values ?? []).map((v) => v.trim()).filter(Boolean);
  return kept.length > 0 ? kept.join(", ") : null;
}

function panelGroups(s: PanelSpecs): SpecGroup[] {
  const l = text.labels;
  return [
    {
      id: "electrical",
      title: text.groups.electrical,
      rows: [
        { key: "wattage_w", label: l.wattage, value: measured(text.units.w, s.wattage_w) },
        { key: "efficiency_percent", label: l.efficiency, value: measured(text.units.percent, s.efficiency_percent) },
        { key: "voltage_at_max_power_v", label: l.voltageMaxPower, value: measured(text.units.v, s.voltage_at_max_power_v) },
        { key: "open_circuit_voltage_v", label: l.openCircuitVoltage, value: measured(text.units.v, s.open_circuit_voltage_v) },
        { key: "current_at_max_power_a", label: l.currentMaxPower, value: measured(text.units.a, s.current_at_max_power_a) },
        { key: "short_circuit_current_a", label: l.shortCircuitCurrent, value: measured(text.units.a, s.short_circuit_current_a) },
      ],
    },
    {
      id: "construction",
      title: text.groups.construction,
      rows: [
        { key: "cell_type", label: l.cellType, value: words(s.cell_type) },
        { key: "country_of_manufacture", label: l.country, value: words(s.country_of_manufacture) },
      ],
    },
    {
      id: "warranty",
      title: text.groups.warranty,
      rows: [
        { key: "product_warranty_years", label: l.productWarranty, value: years(s.product_warranty_years) },
        { key: "performance_warranty_years", label: l.performanceWarranty, value: years(s.performance_warranty_years) },
        { key: "warranty_details", label: l.warrantyDetails, value: words(s.warranty_details) },
      ],
    },
  ];
}

function inverterGroups(s: InverterSpecs): SpecGroup[] {
  const l = text.labels;
  return [
    {
      id: "capacity",
      title: text.groups.capacity,
      rows: [
        {
          key: "category",
          label: l.category,
          value: s.category ? messages.catalogue.filters.typeOptions[s.category] : null,
        },
        { key: "capacity_kw", label: l.capacity, value: measured(text.units.kw, s.capacity_kw) },
        {
          key: "mppt_count",
          label: l.mppt,
          value: s.mppt_count === null || s.mppt_count === undefined ? null : format(text.units.count, { value: s.mppt_count }),
        },
      ],
    },
    {
      id: "connectivity",
      title: text.groups.connectivity,
      rows: [{ key: "connectivity", label: l.connectivity, value: list(s.connectivity) }],
    },
    {
      id: "warranty",
      title: text.groups.warranty,
      rows: [
        { key: "warranty_years", label: l.warranty, value: years(s.warranty_years) },
        { key: "warranty_details", label: l.warrantyDetails, value: words(s.warranty_details) },
      ],
    },
    {
      id: "compatibility",
      title: text.groups.compatibility,
      rows: [{ key: "compatibility_notes", label: l.compatibilityNotes, value: words(s.compatibility_notes) }],
      note: text.compatibilityWarning,
    },
  ];
}

export function specificationGroups(product: ProductDetail): SpecGroup[] {
  return product.kind === "panel"
    ? panelGroups(product.specifications as PanelSpecs)
    : inverterGroups(product.specifications as InverterSpecs);
}

export function countUnspecified(groups: readonly SpecGroup[]): { unspecified: number; total: number } {
  const rows = groups.flatMap((group) => group.rows);
  return { total: rows.length, unspecified: rows.filter((row) => row.value === null).length };
}

/** The sentence summarising how complete the specifications are. */
export function completenessSummary(groups: readonly SpecGroup[]): string {
  const { unspecified, total } = countUnspecified(groups);
  return unspecified === 0
    ? text.summaryNone
    : format(text.summary, { unspecified, total });
}

// ---- links -----------------------------------------------------------------------------------

/** The address if it is a plain http(s) link without embedded credentials, otherwise null. */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** A readable name for a document link: its file name, or else the site it is on. */
export function documentLabel(href: string): string {
  try {
    const url = new URL(href);
    const last = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "");
    return last !== "" ? last : url.hostname;
  } catch {
    return href;
  }
}

export interface DocumentLink {
  href: string;
  label: string;
}

export interface DocumentGroup {
  id: string;
  title: string;
  links: DocumentLink[];
}

function toLinks(urls: readonly (string | null | undefined)[] | null | undefined): DocumentLink[] {
  const seen = new Set<string>();
  const links: DocumentLink[] = [];
  for (const raw of urls ?? []) {
    const href = safeExternalUrl(raw);
    if (href !== null && !seen.has(href)) {
      seen.add(href);
      links.push({ href, label: documentLabel(href) });
    }
  }
  return links;
}

/** Every document attached to the product, grouped, with unsafe or duplicate links dropped. */
export function documentGroups(product: ProductDetail): DocumentGroup[] {
  const names = messages.detail.documents.groups;
  const attachedDatasheets = (product.media ?? [])
    .filter((item) => item.category === "product_datasheet")
    .map((item) => item.url);
  const groups: DocumentGroup[] = [
    { id: "datasheets", title: names.datasheets, links: toLinks([...(product.datasheet_urls ?? []), ...attachedDatasheets]) },
  ];
  if (product.kind === "inverter") {
    const s = product.specifications as InverterSpecs;
    groups.push(
      { id: "manuals", title: names.manuals, links: toLinks(s.manual_urls) },
      { id: "manufacturer", title: names.manufacturer, links: toLinks(s.manufacturer_document_urls) },
      { id: "error-codes", title: names.errorCodes, links: toLinks(s.error_code_reference_urls) },
      { id: "compatibility", title: names.compatibility, links: toLinks([s.compatibility_source_url]) },
    );
  }
  return groups.filter((group) => group.links.length > 0);
}

export function productImages(product: ProductDetail): DocumentLink[] {
  return (product.media ?? [])
    .filter((item) => item.category === "product_image")
    .flatMap((item) => {
      const href = safeExternalUrl(item.url);
      return href !== null && href.startsWith("https:") ? [{ href, label: item.id }] : [];
    });
}

/** "15 September 2026", or null when the timestamp is missing or not a date. */
export function formatLongDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "UTC" });
}

export interface SourceInfo {
  url: string | null;
  /** ISO timestamp the specifications were last checked against the source, if recorded. */
  verifiedAt: string | null;
}

export function sourceInfo(product: ProductDetail): SourceInfo {
  return { url: safeExternalUrl(product.source_url), verifiedAt: product.verified_at ?? null };
}

// ---- offers ----------------------------------------------------------------------------------

/** "LKR 450,000.00", or null when the company gave no price (which is not the same as zero). */
export function formatOfferPrice(offer: Pick<PublicProductOffer, "indicative_price" | "currency">): string | null {
  if (offer.indicative_price === null || offer.indicative_price === undefined) return null;
  const amount = Number(offer.indicative_price);
  if (!Number.isFinite(amount)) return null;
  const formatted = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return format(messages.detail.offers.priceFormat, {
    currency: offer.currency ?? "",
    amount: formatted,
  }).trim();
}
