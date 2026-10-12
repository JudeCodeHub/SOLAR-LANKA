import type { Metadata } from "next";

import { JoinCompany } from "@/components/company/join-company";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.joinCompany };

export default function JoinCompanyPage() {
  return <JoinCompany />;
}
