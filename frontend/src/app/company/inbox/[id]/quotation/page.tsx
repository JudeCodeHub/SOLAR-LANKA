import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { QuotationDraftView } from "@/components/company/quotation-editor";
import { LoadingState } from "@/components/states/loading-state";
import { isProductId } from "@/lib/catalogue/links";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.companyQuotation };

export default async function QuotationDraftPage(props: PageProps<"/company/inbox/[id]/quotation">) {
  const { id } = await props.params;
  // A malformed id can never name an enquiry, so do not ask the backend.
  if (!isProductId(id)) notFound();
  return (
    <Suspense fallback={<LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />}>
      <QuotationDraftView id={id} />
    </Suspense>
  );
}
