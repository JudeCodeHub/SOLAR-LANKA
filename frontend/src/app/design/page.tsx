import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DesignGallery } from "@/components/design/design-gallery";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.design.title, robots: { index: false } };

/** Development only: the page that shows the design system does not exist in production. */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignGallery />;
}
