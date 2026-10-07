"use client";

import { CircleCheck, Lock, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { OfferForm } from "@/components/company/offer-form";
import { QueryState } from "@/components/query-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SampleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ApiError, ensureApiError } from "@/lib/api/errors";
import { formatOfferPrice } from "@/lib/catalogue/detail";
import { BASE_PATH } from "@/lib/catalogue/links";
import { useCompanyProfile } from "@/lib/company/hooks";
import { productName } from "@/lib/landing/format";
import {
  emptyOfferForm,
  hasChanges,
  type OfferValues,
  offerChanges,
  specLine,
  valuesFromOffer,
} from "@/lib/offers/offer";
import {
  type Offer,
  OFFERS_LIMIT,
  type Product,
  useCatalogueSearch,
  useCreateOffer,
  useOffers,
  useProduct,
  useUpdateOffer,
} from "@/lib/offers/hooks";
import { format, messages } from "@/messages";

const text = messages.company.offers;

/** A company's offers on catalogue products, with adding and editing. Prices stay out of the specifications. */
export function OffersManager({ companyId }: { companyId: string }) {
  const profile = useCompanyProfile(companyId);
  const offers = useOffers(companyId);
  const approved = profile.data?.publication_status === "approved";
  return (
    <>
      {profile.data ? (
        <Alert variant={approved ? "success" : "warning"} role="note" data-visibility={approved ? "approved" : "other"}>
          {approved ? <CircleCheck aria-hidden /> : <TriangleAlert aria-hidden />}
          <AlertDescription className="text-ink">
            {approved ? text.visibility.approved : text.visibility.other}{" "}
            {approved ? null : (
              <Link href={`/company/profile?company=${companyId}`} className="inline-flex min-h-11 items-center font-medium text-orange-text underline underline-offset-2">
                {text.visibility.manageProfile}
              </Link>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="offers-title" className="space-y-4">
        <h2 id="offers-title" className="type-heading text-ink">
          {text.listTitle}
        </h2>
        <p className="type-small text-ink-2">{text.notDeletable}</p>
        <QueryState
          query={offers}
          isEmpty={(items) => items.length === 0}
          empty={<p className="type-body rounded-card border border-line bg-surface p-4 text-ink-2" data-no-offers>{text.empty}</p>}
        >
          {(items) => (
            <>
              {items.length >= OFFERS_LIMIT ? (
                <p className="type-small text-ink-2">{format(text.limit, { count: OFFERS_LIMIT })}</p>
              ) : null}
              <ul className="space-y-4" data-offers>
                {items.map((offer) => (
                  <li key={offer.id}>
                    <OfferCard offer={offer} companyId={companyId} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </QueryState>
      </section>

      <AddOffer companyId={companyId} existing={new Set((offers.data ?? []).map((offer) => offer.product_id))} />
    </>
  );
}

export function SpecBlock({ product }: { product: Product | null | undefined }) {
  return (
    <div className="space-y-1.5 rounded-field border border-line bg-paper-2 p-4 text-sm" data-specs>
      <h4 className="flex items-center gap-2 font-medium text-ink">
        <Lock aria-hidden className="size-4 text-ink-3" />
        {text.specs.title}
      </h4>
      {product ? <p className="type-figure text-ink">{specLine(product)}</p> : null}
      <p className="text-ink-2">{text.specs.readOnly}</p>
    </div>
  );
}

export function Preview({ offer }: { offer: Pick<Offer, "indicative_price" | "currency" | "is_demo_price" | "company_claim"> }) {
  const price = formatOfferPrice(offer);
  return (
    <div className="space-y-2 rounded-field border border-line bg-surface p-4 text-sm" data-preview>
      <h4 className="font-medium text-ink">{text.offer.preview}</h4>
      <p className="flex flex-wrap items-center gap-2 text-ink">
        <span className="font-medium">{text.offer.price}: </span>
        {price ? <span className="type-figure">{price}</span> : <span data-no-price>{text.offer.noPrice}</span>}
        {price && offer.is_demo_price ? (
          <SampleBadge data-sample-price>{text.offer.sample}</SampleBadge>
        ) : null}
      </p>
      <p className="text-ink">
        <span className="font-medium">{text.offer.claim}: </span>
        {offer.company_claim ?? <span className="text-ink-2">{text.offer.noClaim}</span>}
      </p>
    </div>
  );
}

function OfferCard({ offer, companyId }: { offer: Offer; companyId: string }) {
  const product = useProduct(offer.product_id);
  const update = useUpdateOffer(companyId);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const item = product.data;
  const name = item ? productName(item) : text.unknownProduct;
  const headingId = `offer-${offer.id}`;

  return (
    <article aria-labelledby={headingId} className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6" data-offer={offer.product_id}>
      <header className="space-y-1">
        <h3 id={headingId} className="type-subheading text-ink">
          {name}
        </h3>
        {item ? (
          <p className="text-sm text-ink-2">
            {(messages.company.offers.kind as Record<string, string>)[item.kind]}
            {" · "}
            <Link href={`${BASE_PATH[item.kind]}/${item.id}`} className="inline-flex min-h-11 items-center font-medium text-orange-text underline underline-offset-2">
              {text.viewProduct}
            </Link>
          </p>
        ) : null}
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {item ? <SpecBlock product={item} /> : <p className="type-small text-ink-2">{product.isPending ? "…" : text.unknownProduct}</p>}
        <div className="space-y-2">
          <h4 className="font-medium text-ink">{text.offer.title}</h4>
          <Preview offer={offer} />
        </div>
      </div>
      {message ? (
        <Alert variant="success" role="status" data-message>
          <CircleCheck aria-hidden />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {problem ? <ApiErrorMessage error={problem} /> : null}
      {editing ? (
        <div className="space-y-3 rounded-card border-2 border-orange-text/50 bg-paper p-4" data-editing>
          <h4 className="font-medium text-ink">{text.offer.editing}</h4>
          <OfferForm
            initial={valuesFromOffer(offer)}
            submitLabel={text.form.save}
            onCancel={() => setEditing(false)}
            onSubmit={async (values: OfferValues) => {
              setMessage(null);
              setProblem(null);
              const changes = offerChanges(offer, values);
              if (!hasChanges(changes)) {
                setMessage(text.form.nothing);
                return;
              }
              try {
                await update.mutateAsync({ offerId: offer.id, changes });
                setEditing(false);
                setMessage(text.form.saved);
              } catch (error) {
                const failure = ensureApiError(error);
                if (failure.status === 404) {
                  setEditing(false);
                  setMessage(text.stale.notYours);
                } else {
                  throw failure;
                }
              }
            }}
          />
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setMessage(null);
            setEditing(true);
          }}
          aria-label={format(text.offer.editFor, { name })}
        >
          {text.offer.edit}
        </Button>
      )}
    </article>
  );
}

function AddOffer({ companyId, existing }: { companyId: string; existing: Set<string> }) {
  const create = useCreateOffer(companyId);
  const [kind, setKind] = useState<"panel" | "inverter">("panel");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState<string | null>(null);
  const [chosen, setChosen] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const results = useCatalogueSearch(kind, search ?? "", search !== null);
  const add = text.add;

  return (
    <section aria-labelledby="add-title" className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6">
      <h2 id="add-title" className="type-heading text-ink">
        {add.title}
      </h2>
      <p className="type-small text-ink-2">{add.intro}</p>
      {message ? (
        <Alert variant="success" role="status" data-add-message>
          <CircleCheck aria-hidden />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">{add.kind}</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {(["panel", "inverter"] as const).map((value) => (
            <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 text-ink">
              <input
                type="radio"
                className="field-radio size-6"
                name="offer-kind"
                checked={kind === value}
                onChange={() => {
                  setKind(value);
                  setSearch(null);
                  setChosen(null);
                }}
              />
              <span>{value === "panel" ? add.panels : add.inverters}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <form
        role="search"
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const query = draft.trim();
          // The same search again must still ask again: the catalogue may have changed.
          if (query === search) void results.refetch();
          else setSearch(query);
          setChosen(null);
          setMessage(null);
        }}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="offer-search" className="text-sm font-medium text-ink">
            {add.search}
          </label>
          <input
            id="offer-search"
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoComplete="off"
            className="field-control mt-1 h-11 w-full px-3.5"
          />
        </div>
        <Button type="submit">{add.searchButton}</Button>
      </form>

      {search !== null ? (
        <QueryState
          query={results}
          isEmpty={(page) => page.items.length === 0}
          empty={<p className="type-small text-ink-2">{add.none}</p>}
        >
          {(page) => (
            <>
              <h3 className="font-medium text-ink">{add.results}</h3>
              <ul className="space-y-2" data-results>
                {page.items.map((product) => {
                  const name = productName(product);
                  const has = existing.has(product.id);
                  return (
                    <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-line p-3 text-sm">
                      <span>
                        <span className="block font-medium text-ink">{name}</span>
                        <span className="block text-ink-2">
                          {specLine({
                            kind: product.kind,
                            specifications: {
                              wattage_w: product.wattage_w,
                              efficiency_percent: product.efficiency_percent,
                              category: product.category,
                              capacity_kw: product.capacity_kw,
                            },
                          })}
                        </span>
                      </span>
                      {has ? (
                        <span className="font-medium text-ink-2" data-has-offer>
                          {add.hasOffer}
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          aria-label={format(add.choose, { name })}
                          onClick={() => {
                            setChosen({ id: product.id, name });
                            setMessage(null);
                          }}
                        >
                          {add.addButton}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </QueryState>
      ) : null}

      {chosen ? (
        <div className="space-y-3 rounded-card border-2 border-orange-text/50 bg-paper p-4 sm:p-5" data-new-offer>
          <h3 className="type-subheading text-ink">{format(add.offerFor, { name: chosen.name })}</h3>
          <OfferForm
            initial={emptyOfferForm}
            submitLabel={text.form.create}
            onCancel={() => setChosen(null)}
            onSubmit={async (values) => {
              try {
                await create.mutateAsync({ productId: chosen.id, values });
                setChosen(null);
                setMessage(text.form.created);
              } catch (error) {
                const failure = ensureApiError(error);
                if (failure.status === 409) {
                  // Someone at the company added it first: the list now has it.
                  setChosen(null);
                  setMessage(text.stale.duplicate);
                } else if (failure.status === 404) {
                  setChosen(null);
                  setMessage(text.stale.gone);
                } else {
                  throw failure;
                }
              }
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
