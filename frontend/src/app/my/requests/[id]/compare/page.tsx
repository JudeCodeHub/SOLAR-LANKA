import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CompareView } from "@/components/requests/compare-view";
import { isProductId } from "@/lib/catalogue/links";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.compareOffers };

export default async function CompareOffersPage(props: PageProps<"/my/requests/[id]/compare">) {
  const { id } = await props.params;
  if (!isProductId(id)) notFound();
  return <CompareView requestId={id} />;
}
