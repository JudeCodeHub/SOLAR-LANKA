"use client";

import { CircleAlert, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { emptyRow, MAX_SLOTS, type SlotRow } from "@/lib/visits/slots";
import { format, messages } from "@/messages";

const text = messages.visits;

/** One to three preferred times, each a date with a start and an end, in Sri Lanka time. */
export function SlotFields({ id, rows, errors, onChange }: { id: string; rows: SlotRow[]; errors: Record<string, string>; onChange: (rows: SlotRow[]) => void }) {
  const set = (index: number, field: keyof SlotRow, value: string) => onChange(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  const field = (index: number, name: keyof SlotRow, label: string, type: string) => {
    const fid = `${id}-${index}-${name}`;
    const error = errors[`${index}.${name}`];
    return (
      <div className="space-y-1">
        <label htmlFor={fid} className="block font-medium text-ink">
          {label}
        </label>
        <input
          id={fid}
          type={type}
          value={rows[index]?.[name] ?? ""}
          onChange={(event) => set(index, name, event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fid}-error` : undefined}
          className="h-11 w-full field-control px-3"
        />
        {error ? (
          <p id={`${fid}-error`} className="flex items-center gap-1.5 font-medium text-danger" data-error={`${index}.${name}`}>
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {error}
          </p>
        ) : null}
      </div>
    );
  };
  return (
    <fieldset className="space-y-3 text-sm" data-slots>
      <legend className="type-subheading text-ink">{text.slot.legend}</legend>
      <p className="text-ink-2">{text.slot.help}</p>
      <p className="flex items-center gap-2 font-medium text-ink" data-zone-note>
        <Clock aria-hidden className="size-4 shrink-0 text-orange-text" />
        {text.zoneNote}
      </p>
      {errors.slots ? (
        <p className="flex items-center gap-1.5 font-medium text-danger" data-error="slots">
          <CircleAlert aria-hidden className="size-4 shrink-0" />
          {errors.slots}
        </p>
      ) : null}
      {rows.map((_, index) => (
        <div key={index} className="grid gap-3 rounded-card border border-line bg-paper p-4 sm:grid-cols-3" data-slot-row={index}>
          <p className="type-subheading text-ink sm:col-span-3">{format(text.slot.label, { number: index + 1 })}</p>
          {field(index, "date", text.slot.date, "date")}
          {field(index, "start", text.slot.start, "time")}
          {field(index, "end", text.slot.end, "time")}
          {rows.length > 1 ? (
            <Button type="button" variant="outline" className="sm:col-span-3 sm:w-fit" onClick={() => onChange(rows.filter((_, i) => i !== index))}>
              {format(text.slot.remove, { number: index + 1 })}
            </Button>
          ) : null}
        </div>
      ))}
      {rows.length < MAX_SLOTS ? (
        <Button type="button" variant="outline" onClick={() => onChange([...rows, emptyRow()])}>
          {text.slot.add}
        </Button>
      ) : null}
    </fieldset>
  );
}
