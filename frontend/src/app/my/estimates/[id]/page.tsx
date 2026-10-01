import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SavedEstimateView } from "@/components/estimates/saved-estimate-view";
import { isProductId } from "@/lib/catalogue/links";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.savedEstimate };

export default async function SavedEstimatePage(props: PageProps<"/my/estimates/[id]">) {
  const { id } = await props.params;
  // A malformed id can never name an estimate, so do not ask the backend.
  if (!isProductId(id)) notFound();
  return <SavedEstimateView id={id} />;
}
