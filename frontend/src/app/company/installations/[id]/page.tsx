import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { InstallationManager } from "@/components/company/installation-manager";
import { LoadingState } from "@/components/states/loading-state";
import { isProductId } from "@/lib/catalogue/links";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.companyInstallation };

export default async function CompanyInstallationPage(props: PageProps<"/company/installations/[id]">) {
  const { id } = await props.params;
  // A malformed id can never name an installation, so do not ask the backend.
  if (!isProductId(id)) notFound();
  return (
    <Suspense fallback={<LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />}>
      <InstallationManager id={id} />
    </Suspense>
  );
}
