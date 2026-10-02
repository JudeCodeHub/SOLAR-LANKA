import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CompanyReview } from "@/components/admin/company-review";
import { isProductId } from "@/lib/catalogue/links";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.adminCompany };

export default async function AdminCompanyPage(props: PageProps<"/admin/companies/[id]">) {
  const { id } = await props.params;
  // A malformed id can never name a company, so do not ask the backend.
  if (!isProductId(id)) notFound();
  return <CompanyReview id={id} />;
}
