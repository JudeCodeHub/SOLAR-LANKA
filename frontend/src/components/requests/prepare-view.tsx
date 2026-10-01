"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { QueryState } from "@/components/query-state";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/lib/catalogue/detail";
import { rangeText } from "@/lib/estimator/format";
import { useSavedEstimate } from "@/lib/estimates/hooks";
import { parseEstimateParam } from "@/lib/requests/prepare";
import { format, messages, plural } from "@/messages";

const text = messages.requestPrep;

/**
 * Where a customer lands after choosing to ask companies for quotations. It shows the saved
 * estimate the request starts from and exactly what the request would carry. The estimate comes
 * from the API, which only answers for its owner, so someone else's id reads as Not found.
 */
export function PrepareView() {
  const param = parseEstimateParam(useSearchParams().get("estimate"));
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{text.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{text.intro}</p>
      </header>
      {param.kind === "ok" ? (
        <Prepared id={param.id} />
      ) : (
        <EmptyState
          title={param.kind === "invalid" ? text.invalid.title : text.empty.title}
          description={param.kind === "invalid" ? text.invalid.description : text.empty.description}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/my/estimates">{text.empty.mine}</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/estimator">{text.empty.estimate}</Link>
              </Button>
            </div>
          }
        />
      )}
    </div>
  );
}

function Prepared({ id }: { id: string }) {
  const query = useSavedEstimate(id);
  return (
    <QueryState query={query}>
      {(saved) => {
        const { sizing } = saved.estimate;
        const district = saved.inputs.district;
        return (
          <>
            <section aria-labelledby="start-title" className="space-y-2 rounded-lg border p-4">
              <h2 id="start-title" className="font-heading text-xl font-semibold tracking-tight">
                {text.estimate.title}
              </h2>
              <p className="font-medium">
                {format(plural(text.estimate.size, sizing.panel_count.maximum), {
                  capacity: rangeText(sizing.capacity_kwp.minimum, sizing.capacity_kwp.maximum),
                  panels: rangeText(sizing.panel_count.minimum, sizing.panel_count.maximum),
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(text.estimate.saved, {
                  date: formatLongDate(saved.created_at) ?? saved.created_at,
                  version: saved.configuration.version,
                })}
              </p>
              <p className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <Link href={`/my/estimates/${saved.id}`} className="underline underline-offset-2">
                  {text.estimate.view}
                </Link>
                <Link href="/my/estimates" className="underline underline-offset-2">
                  {text.estimate.other}
                </Link>
              </p>
            </section>

            <section aria-labelledby="carries-title" className="space-y-2">
              <h2 id="carries-title" className="font-heading text-xl font-semibold tracking-tight">
                {text.carries.title}
              </h2>
              <p className="text-sm text-muted-foreground">{text.carries.intro}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <dt className="text-muted-foreground">{text.carries.district}</dt>
                <dd>{district}</dd>
                <dt className="text-muted-foreground">{text.carries.consumption}</dt>
                <dd>
                  {format(text.carries.consumptionValue, {
                    value: String(saved.inputs.monthly_consumption_kwh),
                  })}
                </dd>
                <dt className="text-muted-foreground">{text.carries.attached}</dt>
                <dd>
                  {format(text.carries.attachedValue, { version: saved.configuration.version })}
                </dd>
              </dl>
            </section>

            <section aria-labelledby="next-title" className="space-y-2">
              <h2 id="next-title" className="font-heading text-xl font-semibold tracking-tight">
                {text.next.title}
              </h2>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>{text.next.companies}</li>
                <li>{text.next.details}</li>
              </ul>
              <p className="text-sm font-medium" data-nothing-sent>
                {text.next.status}
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/companies">{text.next.browse}</Link>
              </Button>
            </section>
          </>
        );
      }}
    </QueryState>
  );
}
