/** The settings a saved estimate was calculated with, as readable rows. */
import { messages } from "../../messages/index.ts";
import { rangeText } from "../estimator/format.ts";

const labels: Record<string, string> = messages.estimator.saved.labels;

export interface SettingRow {
  label: string;
  value: string;
}

function humanise(key: string): string {
  const text = key.replaceAll("_", " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isRange(value: unknown): value is { low: string | number; high: string | number } {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  const scalar = (v: unknown) => typeof v === "string" || typeof v === "number";
  return keys.length === 2 && keys[0] === "high" && keys[1] === "low" && scalar(value.low) && scalar(value.high);
}

export function settingRows(assumptions: Record<string, unknown>): SettingRow[] {
  const rows: SettingRow[] = [];
  const visit = (value: unknown, path: string[]) => {
    if (isRange(value)) {
      rows.push({ label: path.join(", "), value: rangeText(String(value.low), String(value.high)) });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const last = path.at(-1) ?? "";
        visit(item, [...path.slice(0, -1), `${last} ${index + 1}`]);
      });
      return;
    }
    if (isRecord(value)) {
      for (const [key, child] of Object.entries(value)) {
        visit(child, [...path, labels[key] ?? humanise(key)]);
      }
      return;
    }
    const text = value === null ? messages.estimator.saved.detail.noLimit : String(value);
    rows.push({ label: path.join(", "), value: text });
  };
  visit(assumptions, []);
  return rows;
}
