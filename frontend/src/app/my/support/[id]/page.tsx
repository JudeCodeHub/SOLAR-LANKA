import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CustomerCase } from "@/components/support/customer-support";
import { isProductId } from "@/lib/catalogue/links";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.mySupportCase };

export default async function MySupportCasePage(props: PageProps<"/my/support/[id]">) {
  const { id } = await props.params;
  // A malformed id can never name a request, so do not ask the backend.
  if (!isProductId(id)) notFound();
  return <CustomerCase id={id} />;
}
