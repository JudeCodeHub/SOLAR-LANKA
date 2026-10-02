import type { Metadata } from "next";
import { Suspense } from "react";

import { CatalogueAdmin } from "@/components/admin/catalogue-admin";
import { LoadingState } from "@/components/states/loading-state";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.adminCatalogue };

export default function AdminCataloguePage() {
  return (
    // useSearchParams (the type, search and page) needs a Suspense boundary.
    <Suspense fallback={<LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />}>
      <CatalogueAdmin />
    </Suspense>
  );
}
