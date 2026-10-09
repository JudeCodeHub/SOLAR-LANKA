import type { Metadata } from "next";

import { ContentAdmin } from "@/components/education/content-admin";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.adminEducation };

export default function AdminEducationPage() {
  return <ContentAdmin />;
}
