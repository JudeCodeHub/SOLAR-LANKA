import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CompanyProfile, CompanyProfileUnavailable } from "@/components/directory/company-profile";
import { backHref } from "@/lib/directory/links";
import { loadCompany } from "@/lib/directory/load";
import { format, messages } from "@/messages";

export async function generateMetadata(props: PageProps<"/companies/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const result = await loadCompany(id);
  return result.status === "ok"
    ? { title: format(messages.titles.company, { name: result.company.name }) }
    : { title: messages.titles.notFound };
}

export default async function CompanyPage(props: PageProps<"/companies/[id]">) {
  const [{ id }, search] = await Promise.all([props.params, props.searchParams]);
  const result = await loadCompany(id);
  if (result.status === "not-found") notFound();
  const back = backHref(search.from);
  return result.status === "ok" ? (
    <CompanyProfile company={result.company} backHref={back} />
  ) : (
    <CompanyProfileUnavailable backHref={back} />
  );
}
