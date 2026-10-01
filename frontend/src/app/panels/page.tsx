import type { Metadata } from "next";

import { CataloguePage } from "@/components/catalogue/catalogue-page";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.panels };

export default async function PanelsPage(props: PageProps<"/panels">) {
  return <CataloguePage kind="panel" basePath="/panels" searchParams={await props.searchParams} />;
}
