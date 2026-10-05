"use client";

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
        <label htmlFor={fid} className="block font-medium">
          {label}
        </label>
        <input
          id={fid}
          type={type}
          value={rows[index]?.[name] ?? ""}
          onChange={(event) => set(index, name, event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fid}-error` : undefined}
          className="h-11 w-full field-control px-2"
        />
        {error ? (
          <p id={`${fid}-error`} className="font-medium text-destructive" data-error={`${index}.${name}`}>
            {error}
          </p>
        ) : null}
      </div>
    );
  };
  return (
    <fieldset className="space-y-3 text-sm" data-slots>
      <legend className="font-medium">{text.slot.legend}</legend>
      <p className="text-muted-foreground">{text.slot.help}</p>
      <p className="text-muted-foreground">{text.zoneNote}</p>
      {errors.slots ? (
        <p className="font-medium text-destructive" data-error="slots">
          {errors.slots}
        </p>
      ) : null}
      {rows.map((_, index) => (
        <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3" data-slot-row={index}>
          <p className="font-medium sm:col-span-3">{format(text.slot.label, { number: index + 1 })}</p>
          {field(index, "date", text.slot.date, "date")}
          {field(index, "start", text.slot.start, "time")}
          {field(index, "end", text.slot.end, "time")}
          {rows.length > 1 ? (
            <Button type="button" variant="outline" size="sm" className="sm:col-span-3 sm:w-fit" onClick={() => onChange(rows.filter((_, i) => i !== index))}>
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
