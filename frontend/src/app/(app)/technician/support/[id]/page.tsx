import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TechnicianCase } from "@/components/support/technician-support";
import { isProductId } from "@/lib/catalogue/links";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.technicianSupport };

export default async function TechnicianSupportCasePage(props: PageProps<"/technician/support/[id]">) {
  const { id } = await props.params;
  if (!isProductId(id)) notFound();
  return <TechnicianCase id={id} />;
}
