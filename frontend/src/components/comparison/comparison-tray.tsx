"use client";

import { useQueries } from "@tanstack/react-query";
import { X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { createBrowserApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { CatalogueKind } from "@/lib/catalogue/params";
import { canCompare, compareHref, MAX_COMPARE, MIN_COMPARE } from "@/lib/comparison/selection";
import { useComparison } from "@/lib/comparison/store";
import { productName } from "@/lib/landing/format";
import { queryKeys } from "@/lib/query/keys";
import { format, messages } from "@/messages";

const api = createBrowserApi();
const text = messages.tray;
const KINDS: readonly CatalogueKind[] = ["panel", "inverter"];

/** Fetch one product's record. The result lives in TanStack Query's cache, not in the selection. */
function fetchProduct(kind: CatalogueKind, id: string) {
  return kind === "panel"
    ? unwrap(() => api.GET("/catalogue/panels/{product_id}", { params: { path: { product_id: id } } }))
    : unwrap(() => api.GET("/catalogue/inverters/{product_id}", { params: { path: { product_id: id } } }));
}

function TrayGroup({ kind, ids }: { kind: CatalogueKind; ids: string[] }) {
  const remove = useComparison((state) => state.remove);
  const clear = useComparison((state) => state.clear);
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.product(kind, id),
      queryFn: () => fetchProduct(kind, id),
      staleTime: 5 * 60_000,
    })),
  });
  const ready = canCompare(ids);
  return (
    <section aria-labelledby={`tray-${kind}`} className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <h2 id={`tray-${kind}`} className="text-sm font-medium">
        {text.heading[kind]}{" "}
        <span className="ml-1 font-normal text-muted-foreground">
          {format(text.count, { count: ids.length, max: MAX_COMPARE })}
        </span>
      </h2>
      <ul className="flex flex-wrap gap-2">
        {ids.map((id, index) => {
          const result = results[index];
          const name = result?.data
            ? productName(result.data)
            : result?.isError
              ? // Only a real 404 means the product is gone; anything else is a loading problem.
                result.error.status === 404
                ? text.unavailableItem
                : text.nameFailed
              : text.loadingName;
          return (
            <li key={id} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pr-1 pl-3 text-sm">
              <span>{name}</span>
              <button
                type="button"
                onClick={() => remove(kind, id)}
                aria-label={format(text.remove, { name })}
                className="inline-flex size-6 items-center justify-center rounded-full outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="ml-auto flex items-center gap-2">
        {ready ? (
          <Button asChild size="sm">
            <Link href={compareHref(kind, ids)}>{text.compareNow}</Link>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{format(text.needMore, { min: MIN_COMPARE })}</span>
        )}
        <Button variant="ghost" size="sm" onClick={() => clear(kind)}>
          {text.clear}
        </Button>
      </div>
    </section>
  );
}

/** The comparison tray, shown whenever something is selected. */
export function ComparisonTray() {
  const selection = useComparison((state) => state.selection);
  const hydrated = useComparison((state) => state.hydrated);

  // Read the saved selection once the page is interactive, so server and first client render agree.
  useEffect(() => {
    void Promise.resolve(useComparison.persist.rehydrate()).then(() =>
      useComparison.getState().markHydrated(),
    );
  }, []);

  const kinds = KINDS.filter((kind) => selection[kind].length > 0);
  if (!hydrated || kinds.length === 0) {
    return null;
  }
  return (
    <aside
      aria-label={text.label}
      className="sticky bottom-0 z-40 space-y-2 border-t bg-background/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur"
    >
      <div className="mx-auto w-full max-w-6xl space-y-2">
        {kinds.map((kind) => (
          <TrayGroup key={kind} kind={kind} ids={selection[kind]} />
        ))}
      </div>
    </aside>
  );
}
