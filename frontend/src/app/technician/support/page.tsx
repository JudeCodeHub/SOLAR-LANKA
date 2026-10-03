import type { Metadata } from "next";

import { TechnicianCases } from "@/components/support/technician-support";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.technicianSupport };

export default function TechnicianSupportPage() {
  return <TechnicianCases />;
}
