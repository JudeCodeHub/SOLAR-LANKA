import type { Metadata } from "next";

import { CataloguePage } from "@/components/catalogue/catalogue-page";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.inverters };

export default async function InvertersPage(props: PageProps<"/inverters">) {
  return (
    <CataloguePage kind="inverter" basePath="/inverters" searchParams={await props.searchParams} />
  );
}
