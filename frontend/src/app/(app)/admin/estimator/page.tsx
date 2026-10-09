import type { Metadata } from "next";

import { EstimatorAdmin } from "@/components/admin/estimator-admin";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.adminEstimator };

export default function AdminEstimatorPage() {
  return <EstimatorAdmin />;
}
