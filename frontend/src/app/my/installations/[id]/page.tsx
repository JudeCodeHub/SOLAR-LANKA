import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TrackingView } from "@/components/installations/tracking-view";
import { isProductId } from "@/lib/catalogue/links";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.installationTracking };

export default async function InstallationPage(props: PageProps<"/my/installations/[id]">) {
  const { id } = await props.params;
  const { accepted } = await props.searchParams;
  if (!isProductId(id)) notFound();
  return <TrackingView id={id} justAccepted={accepted === "1"} />;
}
