import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TechnicianVisit } from "@/components/visits/technician-visit";
import { isProductId } from "@/lib/catalogue/links";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.technicianVisit };

export default async function TechnicianVisitPage(props: PageProps<"/technician/visits/[id]">) {
  const { id } = await props.params;
  // A malformed id can never name a visit, so do not ask the backend.
  if (!isProductId(id)) notFound();
  return <TechnicianVisit id={id} />;
}
