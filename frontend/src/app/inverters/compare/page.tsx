import type { Metadata } from "next";

import { ComparePage } from "@/components/comparison/compare-page";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.compareInverters };

export default async function InverterComparisonPage(props: PageProps<"/inverters/compare">) {
  return <ComparePage kind="inverter" searchParams={await props.searchParams} />;
}
