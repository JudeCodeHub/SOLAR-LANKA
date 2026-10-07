"use client";

import { CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { type UseFormReturn, useWatch } from "react-hook-form";

import { SelectField } from "@/components/forms/select-field";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { productName } from "@/lib/landing/format";
import { useCatalogueSearch, useProduct } from "@/lib/offers/hooks";
import { type DraftValues, formatMoney } from "@/lib/quotation/draft";
import { specLine } from "@/lib/offers/offer";
import { format, messages } from "@/messages";

const text = messages.company.quotation.lines;

/** One quotation line: type, catalogue product (for equipment), description, quantity, price and the server's total. */
export function QuotationLine({
  form,
  index,
  lineTotal,
  canRemove,
  onRemove,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the form's input type is wider than the output
  form: UseFormReturn<any, unknown, any>;
  index: number;
  lineTotal: string | null | undefined;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const kind = useWatch({ control: form.control, name: `lines.${index}.kind` }) as DraftValues["lines"][number]["kind"];
  const productId = useWatch({ control: form.control, name: `lines.${index}.product_id` }) as string;
  const error = (form.formState.errors.lines as unknown as { product_id?: { message?: string } }[] | undefined)?.[index]?.product_id?.message;
  const product = useProduct(productId);
  const [picking, setPicking] = useState(false);
  const total = formatMoney(lineTotal);

  // A charge never refers to a product, so leaving the equipment type clears it.
  useEffect(() => {
    if (kind === "charge" && productId !== "") form.setValue(`lines.${index}.product_id`, "");
  }, [kind, productId, form, index]);

  return (
    <fieldset className="space-y-4 rounded-card border border-line bg-paper p-4 sm:p-5" data-line={index}>
      <legend className="type-subheading px-2 text-ink">{format(text.line, { number: index + 1 })}</legend>
      <SelectField
        form={form}
        name={`lines.${index}.kind`}
        label={text.kind}
        options={[
          { value: "equipment", label: text.kinds.equipment },
          { value: "charge", label: text.kinds.charge },
        ]}
      />
      {kind === "equipment" ? (
        <div className="space-y-2" data-product>
          <p className="font-medium text-ink">{text.product}</p>
          {productId !== "" ? (
            <p className="rounded-field border border-line bg-surface px-3 py-2 text-sm text-ink" data-product-name>
              {product.isPending ? text.productLoading : product.data ? productName(product.data) : text.productGone}
            </p>
          ) : null}
          {error ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-danger" data-product-error>
              <CircleAlert aria-hidden className="size-4 shrink-0" />
              {error}
            </p>
          ) : null}
          {!picking ? (
            <Button type="button" variant="outline" onClick={() => setPicking(true)}>
              {productId === "" ? text.chooseProduct : text.changeProduct}
            </Button>
          ) : (
            <ProductPicker
              onCancel={() => setPicking(false)}
              onPick={(id, label) => {
                form.setValue(`lines.${index}.product_id`, id, { shouldDirty: true, shouldValidate: true });
                if ((form.getValues(`lines.${index}.description`) as string).trim() === "") {
                  form.setValue(`lines.${index}.description`, label, { shouldDirty: true, shouldValidate: true });
                }
                setPicking(false);
              }}
            />
          )}
        </div>
      ) : null}
      <TextField form={form} name={`lines.${index}.description`} label={text.description} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField form={form} name={`lines.${index}.quantity`} label={text.quantity} inputMode="decimal" />
        <TextField form={form} name={`lines.${index}.unit_price`} label={text.unitPrice} inputMode="decimal" />
      </div>
      <p className="type-figure rounded-field bg-paper-2 px-3 py-2 text-ink" data-line-total>
        {total ? format(text.lineTotal, { total }) : text.lineTotalPending}
      </p>
      {canRemove ? (
        <Button type="button" variant="outline" aria-label={format(text.remove, { number: index + 1 })} onClick={onRemove}>
          {text.removeShort}
        </Button>
      ) : null}
    </fieldset>
  );
}

function ProductPicker({ onPick, onCancel }: { onPick: (id: string, label: string) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<"panel" | "inverter">("panel");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState<string | null>(null);
  const results = useCatalogueSearch(kind, search ?? "", search !== null);
  const inputId = `picker-${kind}-search`;

  return (
    <div className="space-y-4 rounded-card border-2 border-orange-text/50 bg-surface p-4" data-picker>
      <fieldset className="space-y-2">
        <legend className="font-medium text-ink">{text.pickerKind}</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {(["panel", "inverter"] as const).map((value) => (
            <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 text-ink">
              <input type="radio" className="field-radio size-6" checked={kind === value} onChange={() => { setKind(value); setSearch(null); }} />
              <span>{value === "panel" ? text.panels : text.inverters}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {text.search}
          </label>
          <input
            id={inputId}
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoComplete="off"
            className="field-control mt-1 h-11 w-full px-3.5"
          />
        </div>
        <Button type="button" onClick={() => (draft.trim() === search ? void results.refetch() : setSearch(draft.trim()))}>
          {text.searchButton}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {messages.company.offers.form.cancel}
        </Button>
      </div>
      {search !== null && results.data ? (
        results.data.items.length === 0 ? (
          <p className="type-small text-ink-2">{text.none}</p>
        ) : (
          <ul className="space-y-2" data-picker-results>
            {results.data.items.map((item) => {
              const name = productName(item);
              return (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-line p-3 text-sm">
                  <span>
                    <span className="block font-medium text-ink">{name}</span>
                    <span className="block text-ink-2">
                      {specLine({
                        kind: item.kind,
                        specifications: {
                          wattage_w: item.wattage_w,
                          efficiency_percent: item.efficiency_percent,
                          category: item.category,
                          capacity_kw: item.capacity_kw,
                        },
                      })}
                    </span>
                  </span>
                  <Button type="button" variant="outline" aria-label={format(text.use, { name })} onClick={() => onPick(item.id, name)}>
                    {text.useShort}
                  </Button>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </div>
  );
}
