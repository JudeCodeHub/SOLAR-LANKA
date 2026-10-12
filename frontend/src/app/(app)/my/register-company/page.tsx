import type { Metadata } from "next";

import { RegisterCompany } from "@/components/company/register-company";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.registerCompany };

export default function RegisterCompanyPage() {
  return <RegisterCompany />;
}
