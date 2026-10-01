"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";

import type { ChartSpec } from "@/lib/estimator/results";
import { format, messages } from "@/messages";

const text = messages.estimator.results.charts;

/**
 * A horizontal bar chart with the same figures as a table directly beneath it. The picture is one
 * labelled image for assistive technology (its summary is the text), every bar carries its value
 * so colour is never the only cue, and there is no animation.
 */
export default function ResultChart({ spec }: { spec: ChartSpec }) {
  return (
    <figure className="space-y-3">
      <figcaption className="font-medium">{spec.title}</figcaption>
      <div role="img" aria-label={spec.summary} className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={spec.bars}
            layout="vertical"
            margin={{ top: 4, right: 56, bottom: 4, left: 4 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tick={{ fontSize: 12 }}
              interval={0}
            />
            <Bar dataKey="value" fill="var(--chart-3)" isAnimationActive={false}>
              <LabelList dataKey="label" position="right" fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">{spec.unit}</p>
      <table className="w-full text-sm">
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
      </table>
    </figure>
  );
}
