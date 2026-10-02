import type { Metadata } from "next";

import { ConfigEditor } from "@/components/admin/config-editor";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.adminEstimatorVersion };

export default function NewEstimatorDraftPage() {
  return <ConfigEditor id={null} />;
}
