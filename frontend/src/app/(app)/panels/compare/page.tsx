import type { Metadata } from "next";

import { ComparePage } from "@/components/comparison/compare-page";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.comparePanels };

export default async function PanelComparisonPage(props: PageProps<"/panels/compare">) {
  return <ComparePage kind="panel" searchParams={await props.searchParams} />;
}
