"use client";

import { Table } from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";

import type { ChartSpec } from "@/lib/estimator/results";
import { format, messages } from "@/messages";

const text = messages.estimator.results.charts;

/** Colour-blind-safe pair (blue and vermilion, as in the Okabe-Ito set) drawn from the theme, and a pattern for each kind of bar, so the bars differ in shape as well as in colour. */
const BLUE = "var(--ds-info)";
const ORANGE = "var(--ds-orange-text)";

function fillFor(chart: string, kind: "base" | "low" | "high") {
  return kind === "high" ? ORANGE : `url(#${chart}-${kind})`;
}

/** The two patterns: blue with a dotted texture for the starting point, vermilion with diagonal stripes for the low end. The high end is plain vermilion. */
function Patterns({ chart }: { chart: string }) {
  return (
    <defs>
      <pattern id={`${chart}-base`} width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill={BLUE} />
        <circle cx="4" cy="4" r="1.4" fill="var(--ds-surface)" opacity="0.55" />
      </pattern>
      <pattern id={`${chart}-low`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="8" height="8" fill="var(--ds-orange-tint)" />
        <rect width="4" height="8" fill={ORANGE} />
      </pattern>
    </defs>
  );
}

/** A horizontal bar chart with the same figures as a table directly beneath it. */
export default function ResultChart({ spec }: { spec: ChartSpec }) {
  return (
    <figure className="space-y-3">
      <figcaption className="type-subheading text-ink">{spec.title}</figcaption>
      <div role="img" aria-label={spec.summary} className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={spec.bars}
            layout="vertical"
            margin={{ top: 4, right: 56, bottom: 4, left: 4 }}
          >
            <Patterns chart={spec.id} />
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--ds-line)" />
            <XAxis type="number" tick={{ fontSize: 12, fill: "var(--ds-text-2)" }} stroke="var(--ds-line)" />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tick={{ fontSize: 12, fill: "var(--ds-text)" }}
              stroke="var(--ds-line)"
              interval={0}
            />
            <Bar dataKey="value" isAnimationActive={false}>
              {spec.bars.map((entry) => (
                <Cell key={entry.name} fill={fillFor(spec.id, entry.kind)} stroke={entry.kind === "base" ? BLUE : ORANGE} strokeWidth={1.5} data-kind={entry.kind} />
              ))}
              <LabelList dataKey="label" position="right" fontSize={12} fill="var(--ds-text)" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="type-small text-ink-2">{spec.unit}</p>
      <Table className="w-full text-sm">
        <caption className="pb-1 text-left text-xs text-muted-foreground">{text.tableNote}</caption>
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="py-1 pr-4 font-medium">
              {text.name}
            </th>
            <th scope="col" className="py-1 font-medium">
              {format(text.valueWithUnit, { unit: spec.unit })}
            </th>
          </tr>
        </thead>
        <tbody>
          {spec.bars.map((bar) => (
            <tr key={bar.name} className="border-b last:border-0">
              <th scope="row" className="py-1 pr-4 text-left font-normal">
                {bar.name}
              </th>
              <td className="py-1">{bar.label}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </figure>
  );
}
