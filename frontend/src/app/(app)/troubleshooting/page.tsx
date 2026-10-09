import type { Metadata } from "next";

import { TroubleshootingView } from "@/components/support/troubleshooting-view";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.troubleshooting };

export default function TroubleshootingPage() {
  return <TroubleshootingView />;
}
