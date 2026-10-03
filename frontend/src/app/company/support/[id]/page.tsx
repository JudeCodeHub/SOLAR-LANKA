import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CompanyCase } from "@/components/support/company-support";
import { LoadingState } from "@/components/states/loading-state";
import { isProductId } from "@/lib/catalogue/links";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.companySupport };

export default async function CompanySupportCasePage(props: PageProps<"/company/support/[id]">) {
  const { id } = await props.params;
  if (!isProductId(id)) notFound();
  return (
    <Suspense fallback={<LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />}>
      <CompanyCase id={id} />
    </Suspense>
  );
}
