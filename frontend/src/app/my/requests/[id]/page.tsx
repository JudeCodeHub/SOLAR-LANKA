import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RequestView } from "@/components/requests/request-view";
import { isProductId } from "@/lib/catalogue/links";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.requestProgress };

export default async function RequestPage(props: PageProps<"/my/requests/[id]">) {
  const { id } = await props.params;
  // A malformed id can never name a request, so do not ask the backend.
  if (!isProductId(id)) notFound();
  return <RequestView id={id} />;
}
