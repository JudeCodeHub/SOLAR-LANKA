import type { Metadata } from "next";

import { TechnicianVisits } from "@/components/visits/technician-visits";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.technicianVisits };

export default function TechnicianPage() {
  return <TechnicianVisits />;
}
