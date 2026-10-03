import type { Metadata } from "next";

import { ReferenceAdmin } from "@/components/admin/reference-admin";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.adminTroubleshooting };

export default function AdminTroubleshootingPage() {
  return <ReferenceAdmin />;
}
