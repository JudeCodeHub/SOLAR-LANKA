import type { Metadata } from "next";

import { CustomerDashboard } from "@/components/dashboard/customer-dashboard";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.dashboard };

export default function MyDashboardPage() {
  return <CustomerDashboard />;
}
