/** The rows of a side-by-side comparison. */
import { messages } from "../../messages/index.ts";
import {
  formatLongDate,
  type ProductDetail,
  safeExternalUrl,
  specificationGroups,
} from "../catalogue/detail.ts";

export type CompareCell =
  | { kind: "value"; text: string }
  | { kind: "link"; text: string; href: string }
  | { kind: "unspecified" }
  | { kind: "unavailable" };

export interface CompareRow {
  key: string;
  label: string;
  cells: CompareCell[];
}

export interface CompareSection {
  id: string;
  title: string;
  rows: CompareRow[];
}

const text = messages.compare;

/** `products` has one entry per column, in order; null means that product could not be loaded. */
export function buildComparison(products: readonly (ProductDetail | null)[]): CompareSection[] {
  const available = products.filter((product): product is ProductDetail => product !== null);
  if (available.length === 0) return [];

  // Each available product's rows by key, so columns line up even if a product lacked a group.
  const grouped = products.map((product) =>
    product === null
      ? null
      : new Map(
          specificationGroups(product).flatMap((group) =>
            group.rows.map((row) => [`${group.id}:${row.key}`, row.value] as const),
          ),
        ),
  );

  const template = specificationGroups(available[0] as ProductDetail);
  const sections: CompareSection[] = template.map((group) => ({
    id: group.id,
    title: group.title,
    rows: group.rows.map((row) => ({
      key: row.key,
      label: row.label,
      cells: grouped.map((values): CompareCell => {
        if (values === null) return { kind: "unavailable" };
        const value = values.get(`${group.id}:${row.key}`);
        return value === null || value === undefined
          ? { kind: "unspecified" }
          : { kind: "value", text: value };
      }),
    })),
  }));

  sections.push({
    id: "source",
    title: text.sections.source,
    rows: [
      {
        key: "source",
        label: text.rows.source,
        cells: products.map((product): CompareCell => {
          if (product === null) return { kind: "unavailable" };
          const href = safeExternalUrl(product.source_url);
          return href === null
            ? { kind: "value", text: text.noSource }
            : { kind: "link", text: text.openSource, href };
        }),
      },
      {
        key: "verified",
        label: text.rows.verified,
        cells: products.map((product): CompareCell => {
          if (product === null) return { kind: "unavailable" };
          const date = formatLongDate(product.verified_at);
          return date === null ? { kind: "unspecified" } : { kind: "value", text: date };
        }),
      },
    ],
  });
  return sections;
}

/** How a row's cells relate: the same in every product that could be loaded, different between them, not specified by some, or not specified by any. Products that could not be loaded are left out. */
export function rowRelation(cells: readonly CompareCell[]): "same" | "differs" | "unspecified" | "none" {
  const loaded = cells.filter((cell) => cell.kind !== "unavailable");
  if (loaded.length > 0 && loaded.every((cell) => cell.kind === "unspecified")) return "none";
  if (loaded.some((cell) => cell.kind === "unspecified")) return "unspecified";
  const shown = loaded.map((cell) => (cell.kind === "value" || cell.kind === "link" ? cell.text : ""));
  return new Set(shown).size > 1 ? "differs" : "same";
}
