import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OfferView } from "@/components/requests/offer-view";
import { isProductId } from "@/lib/catalogue/links";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.offerDetail };

export default async function OfferPage(props: PageProps<"/my/requests/[id]/offers/[quotationId]">) {
  const { id, quotationId } = await props.params;
  // Malformed ids can never name a request or an offer, so do not ask the backend.
  if (!isProductId(id) || !isProductId(quotationId)) notFound();
  return <OfferView requestId={id} quotationId={quotationId} />;
}
