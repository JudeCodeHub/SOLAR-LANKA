import type { Metadata } from "next";

import { AdminHome } from "@/components/admin/admin-home";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.dashboard };

export default function AdminHomePage() {
  return <AdminHome />;
}
