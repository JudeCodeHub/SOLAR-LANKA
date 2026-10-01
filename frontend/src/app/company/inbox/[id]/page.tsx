import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EnquiryView } from "@/components/company/enquiry-view";
import { LoadingState } from "@/components/states/loading-state";
import { isProductId } from "@/lib/catalogue/links";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.companyEnquiry };

export default async function EnquiryPage(props: PageProps<"/company/inbox/[id]">) {
  const { id } = await props.params;
  // A malformed id can never name an enquiry, so do not ask the backend.
  if (!isProductId(id)) notFound();
  return (
    <Suspense fallback={<LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />}>
      <EnquiryView id={id} />
    </Suspense>
  );
}
