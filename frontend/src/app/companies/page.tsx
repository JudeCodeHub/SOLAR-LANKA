import type { Metadata } from "next";

import { DirectoryPage } from "@/components/directory/directory-page";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.companies };

export default async function CompaniesPage(props: PageProps<"/companies">) {
  return <DirectoryPage searchParams={await props.searchParams} />;
}
