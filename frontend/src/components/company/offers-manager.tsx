"use client";

import Link from "next/link";
import { useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { OfferForm } from "@/components/company/offer-form";
import { QueryState } from "@/components/query-state";
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
        <p className="text-sm text-muted-foreground" data-visibility={approved ? "approved" : "other"}>
          {approved ? text.visibility.approved : text.visibility.other}{" "}
          {approved ? null : (
            <Link href={`/company/profile?company=${companyId}`} className="underline underline-offset-2">
              {text.visibility.manageProfile}
            </Link>
          )}
        </p>
      ) : null}

      <section aria-labelledby="offers-title" className="space-y-3">
        <h2 id="offers-title" className="font-heading text-xl font-semibold tracking-tight">
          {text.listTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{text.notDeletable}</p>
        <QueryState
          query={offers}
          isEmpty={(items) => items.length === 0}
          empty={<p className="text-sm text-muted-foreground" data-no-offers>{text.empty}</p>}
        >
          {(items) => (
            <>
              {items.length >= OFFERS_LIMIT ? (
                <p className="text-sm text-muted-foreground">{format(text.limit, { count: OFFERS_LIMIT })}</p>
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

function SpecBlock({ product }: { product: Product | null | undefined }) {
  return (
    <div className="space-y-1 rounded-md bg-muted/40 p-3 text-sm" data-specs>
      <h4 className="font-medium">{text.specs.title}</h4>
      {product ? <p>{specLine(product)}</p> : null}
      <p className="text-muted-foreground">{text.specs.readOnly}</p>
    </div>
  );
}

function Preview({ offer }: { offer: Pick<Offer, "indicative_price" | "currency" | "is_demo_price" | "company_claim"> }) {
  const price = formatOfferPrice(offer);
  return (
    <div className="space-y-1 text-sm" data-preview>
      <h4 className="font-medium">{text.offer.preview}</h4>
      <p>
        <span className="font-medium">{text.offer.price}: </span>
        {price ?? <span data-no-price>{text.offer.noPrice}</span>}
        {price && offer.is_demo_price ? (
          <span className="ml-2 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{text.offer.sample}</span>
        ) : null}
      </p>
      <p>
        <span className="font-medium">{text.offer.claim}: </span>
        {offer.company_claim ?? <span className="text-muted-foreground">{text.offer.noClaim}</span>}
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
    <article aria-labelledby={headingId} className="space-y-3 rounded-lg border p-4" data-offer={offer.product_id}>
      <header className="space-y-1">
        <h3 id={headingId} className="font-heading text-lg font-semibold tracking-tight">
          {name}
        </h3>
        {item ? (
          <p className="text-sm text-muted-foreground">
            {(messages.company.offers.kind as Record<string, string>)[item.kind]}
            {" · "}
            <Link href={`${BASE_PATH[item.kind]}/${item.id}`} className="underline underline-offset-2">
              {text.viewProduct}
            </Link>
          </p>
        ) : null}
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {item ? <SpecBlock product={item} /> : <p className="text-sm text-muted-foreground">{product.isPending ? "…" : text.unknownProduct}</p>}
        <div className="space-y-2">
          <h4 className="font-medium">{text.offer.title}</h4>
          <Preview offer={offer} />
        </div>
      </div>
      {message ? (
        <p role="status" className="text-sm font-medium" data-message>
          {message}
        </p>
      ) : null}
      {problem ? <ApiErrorMessage error={problem} /> : null}
      {editing ? (
        <div className="space-y-2 rounded-md border p-3" data-editing>
          <h4 className="font-medium">{text.offer.editing}</h4>
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
          size="sm"
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
    <section aria-labelledby="add-title" className="space-y-3">
      <h2 id="add-title" className="font-heading text-xl font-semibold tracking-tight">
        {add.title}
      </h2>
      <p className="text-sm text-muted-foreground">{add.intro}</p>
      {message ? (
        <p role="status" className="text-sm font-medium" data-add-message>
          {message}
        </p>
      ) : null}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{add.kind}</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {(["panel", "inverter"] as const).map((value) => (
            <label key={value} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
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
          <label htmlFor="offer-search" className="text-sm font-medium">
            {add.search}
          </label>
          <input
            id="offer-search"
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoComplete="off"
            className="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm"
          />
        </div>
        <Button type="submit">{add.searchButton}</Button>
      </form>

      {search !== null ? (
        <QueryState
          query={results}
          isEmpty={(page) => page.items.length === 0}
          empty={<p className="text-sm text-muted-foreground">{add.none}</p>}
        >
          {(page) => (
            <>
              <h3 className="text-sm font-medium">{add.results}</h3>
              <ul className="space-y-2" data-results>
                {page.items.map((product) => {
                  const name = productName(product);
                  const has = existing.has(product.id);
                  return (
                    <li key={product.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                      <span>
                        <span className="block font-medium">{name}</span>
                        <span className="block text-muted-foreground">
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
                        <span className="text-muted-foreground" data-has-offer>
                          {add.hasOffer}
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
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
        <div className="space-y-3 rounded-lg border p-4" data-new-offer>
          <h3 className="font-medium">{format(add.offerFor, { name: chosen.name })}</h3>
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
