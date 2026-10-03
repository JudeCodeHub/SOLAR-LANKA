import type { Metadata } from "next";

import { PublicSupport } from "@/components/support/public-support";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.publicSupport };

export default function SupportPage() {
  return <PublicSupport />;
}
