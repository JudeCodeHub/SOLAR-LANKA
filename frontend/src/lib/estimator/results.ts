/** Turns the estimator's answer into what the results view shows. */
import type { components } from "../api/schema";
import { messages } from "../../messages/index.ts";
import { rangeText } from "./format.ts";

export type Preview = components["schemas"]["EstimatePreviewResponse"];
type Range = { minimum: string | number; maximum: string | number };

const text = messages.estimator.results;

/** The inputs the missing-value reasons depend on. */
export interface SentInputs {
  shading_condition: string | null;
  daytime_consumption_percent: string | null;
}

const group = (value: number, places: number) =>
  value.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: places });

/** Outward-rounded numbers for a range: [low rounded down, high rounded up]. */
export function widen(range: Range, places: number): [number, number] {
  const factor = 10 ** places;
  const low = Math.floor(Number(range.minimum) * factor + 1e-9) / factor;
  const high = Math.ceil(Number(range.maximum) * factor - 1e-9) / factor;
  // Rounding zero upwards gives -0, which would print as "-0".
  return [low || 0, high || 0];
}

export function rangeDisplay(range: Range, places: number): string {
  const [low, high] = widen(range, places);
  return rangeText(group(low, places), group(high, places));
}

export interface ResultRow {
  id: string;
  label: string;
  unit: string;
  /** The formatted estimate, or null when it is not available. */
  value: string | null;
  /** Why it is not available; null when it is. */
  why: string | null;
  /** Money figures carry an Indicative qualifier. */
  indicative: boolean;
  /** The rounded ends of the range, for drawing a bar; null when there is no figure. */
  range: { low: number; high: number } | null;
}

function row(
  id: string,
  label: string,
  unit: string,
  value: string | null,
  why: string,
  indicative = false,
): ResultRow {
  return { id, label, unit, value, why: value === null ? why : null, indicative, range: null };
}

const PLACES: Record<string, number> = { panels: 0, capacity: 2, area: 1, annual: 0, monthly: 0, cost: 0, baseline: 0, monthlySavings: 0, annualSavings: 0, payback: 1 };

/** Give each row that has a figure its numeric range, rounded the same way as the words. */
function withRanges(rows: ResultRow[], ranges: Record<string, Range | null | undefined>): ResultRow[] {
  return rows.map((entry) => {
    const range = ranges[entry.id];
    if (!range || entry.value === null) return entry;
    const [low, high] = widen(range, PLACES[entry.id] ?? 0);
    return { ...entry, range: { low, high } };
  });
}

export function sizingRows(preview: Preview, sent: SentInputs): ResultRow[] {
  const { sizing } = preview;
  const needsShading = text.why.needsShading;
  void sent;
  return withRanges([
    row("panels", text.rows.panels, text.units.panels, rangeDisplay(sizing.panel_count, 0), ""),
    row("capacity", text.rows.capacity, text.units.kwp, rangeDisplay(sizing.capacity_kwp, 2), ""),
    row("area", text.rows.area, text.units.m2, rangeDisplay(sizing.installed_area_m2, 1), ""),
    row(
      "annual",
      text.rows.annual,
      text.units.kwhPerYear,
      sizing.annual_generation_kwh ? rangeDisplay(sizing.annual_generation_kwh, 0) : null,
      needsShading,
    ),
    row(
      "monthly",
      text.rows.monthly,
      text.units.kwhPerMonth,
      sizing.average_monthly_generation_kwh
        ? rangeDisplay(sizing.average_monthly_generation_kwh, 0)
        : null,
      needsShading,
    ),
  ], {
    panels: sizing.panel_count,
    capacity: sizing.capacity_kwp,
    area: sizing.installed_area_m2,
    annual: sizing.annual_generation_kwh,
    monthly: sizing.average_monthly_generation_kwh,
  });
}

/** Which input or publication is missing for the savings figures. */
function savingsReason(preview: Preview, sent: SentInputs): string {
  if (preview.sizing.average_monthly_generation_kwh === null) return text.why.needsShading;
  const exports = preview.scenario !== "grid_net_metering_no_backup";
  if (exports && preview.sources.export === undefined) return text.why.noExport;
  // Net plus sells everything generated, so the daytime share does not matter there.
  if (preview.scenario !== "grid_net_plus_no_backup" && sent.daytime_consumption_percent === null) return text.why.needsDaytime;
  return text.why.noTariff;
}

export function financialRows(preview: Preview, sent: SentInputs): ResultRow[] {
  const { financial } = preview;
  const savingsWhy = savingsReason(preview, sent);
  const savingsKnown = financial.annual_savings_lkr !== null;
  const paybackWhy =
    financial.installed_cost_lkr === null
      ? text.why.dependsOnCost
      : !savingsKnown
        ? text.why.dependsOnSavings
        : text.why.noPositiveSavings;
  return withRanges([
    row(
      "cost",
      text.rows.cost,
      text.units.lkr,
      financial.installed_cost_lkr ? rangeDisplay(financial.installed_cost_lkr, 0) : null,
      text.why.noCost,
      true,
    ),
    row(
      "baseline",
      text.rows.baseline,
      text.units.lkrPerMonth,
      financial.baseline_monthly_bill_lkr === null
        ? null
        : rangeDisplay(
            { minimum: financial.baseline_monthly_bill_lkr, maximum: financial.baseline_monthly_bill_lkr },
            0,
          ),
      savingsWhy,
      true,
    ),
    row(
      "monthlySavings",
      text.rows.monthlySavings,
      text.units.lkrPerMonth,
      financial.monthly_savings_lkr ? rangeDisplay(financial.monthly_savings_lkr, 0) : null,
      savingsWhy,
      true,
    ),
    row(
      "annualSavings",
      text.rows.annualSavings,
      text.units.lkrPerYear,
      financial.annual_savings_lkr ? rangeDisplay(financial.annual_savings_lkr, 0) : null,
      savingsWhy,
      true,
    ),
    row(
      "payback",
      text.rows.payback,
      text.units.years,
      financial.simple_payback_years ? rangeDisplay(financial.simple_payback_years, 1) : null,
      paybackWhy,
      true,
    ),
  ], {
    cost: financial.installed_cost_lkr,
    baseline: financial.baseline_monthly_bill_lkr === null ? null : { minimum: financial.baseline_monthly_bill_lkr, maximum: financial.baseline_monthly_bill_lkr },
    monthlySavings: financial.monthly_savings_lkr,
    annualSavings: financial.annual_savings_lkr,
    payback: financial.simple_payback_years,
  });
}

export interface ChartBar {
  name: string;
  value: number;
  /** The value as shown in the table and on the bar. */
  label: string;
  /** What the bar stands for, which decides its colour and pattern: a starting point, the low end of a range, or its high end. */
  kind: "base" | "low" | "high";
}

export interface ChartSpec {
  id: "energy" | "bill";
  title: string;
  /** What a screen reader hears for the chart; the table carries the same figures. */
  summary: string;
  unit: string;
  bars: ChartBar[];
}

const bar = (name: string, value: number, kind: ChartBar["kind"]): ChartBar => ({ name, value, label: group(value, 0), kind });

/** Charts for the figures that exist; a chart is skipped when any figure it needs is missing. */
export function chartSpecs(preview: Preview, consumptionKwh: string): ChartSpec[] {
  const specs: ChartSpec[] = [];
  const generation = preview.sizing.average_monthly_generation_kwh;
  if (generation !== null) {
    const [low, high] = widen(generation, 0);
    const use = Math.round(Number(consumptionKwh));
    specs.push({
      id: "energy",
      title: text.charts.energyTitle,
      summary: fillSummary(text.charts.energySummary, {
        use: group(use, 0),
        low: group(low, 0),
        high: group(high, 0),
      }),
      unit: text.units.kwhPerMonth,
      bars: [bar(text.charts.use, use, "base"), bar(text.charts.generationLow, low, "low"), bar(text.charts.generationHigh, high, "high")],
    });
  }
  const { baseline_monthly_bill_lkr: baseline, monthly_savings_lkr: savings } = preview.financial;
  if (baseline !== null && savings !== null) {
    const without = Math.round(Number(baseline));
    // The bill with solar is the baseline less the savings; the larger saving gives the lower bill.
    const [saveLow, saveHigh] = widen(savings, 0);
    const withLow = Math.max(without - saveLow, 0);
    const withHigh = Math.max(without - saveHigh, 0);
    specs.push({
      id: "bill",
      title: text.charts.billTitle,
      summary: fillSummary(text.charts.billSummary, {
        without: group(without, 0),
        withLow: group(withLow, 0),
        withHigh: group(withHigh, 0),
      }),
      unit: text.units.lkrPerMonth,
      bars: [
        bar(text.charts.without, without, "base"),
        bar(text.charts.withLow, withLow, "low"),
        bar(text.charts.withHigh, withHigh, "high"),
      ],
    });
  }
  return specs;
}

function fillSummary(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

/** What the roof did to the size: nothing fits, all the room is used, or neither. */
export function roofNote(preview: Preview): "none" | "limited" | null {
  const { panel_count: count, roof_panel_capacity: capacity } = preview.sizing;
  if (capacity === 0) return "none";
  return count.maximum === capacity ? "limited" : null;
}
