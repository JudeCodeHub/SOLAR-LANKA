import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ConfigEditor } from "@/components/admin/config-editor";
import { isProductId } from "@/lib/catalogue/links";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.adminEstimatorVersion };

export default async function EstimatorVersionPage(props: PageProps<"/admin/estimator/[id]">) {
  const { id } = await props.params;
  // A malformed id can never name a version, so do not ask the backend.
  if (!isProductId(id)) notFound();
  return <ConfigEditor id={id} />;
}
