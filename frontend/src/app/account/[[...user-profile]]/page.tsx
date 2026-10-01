import { UserProfile } from "@clerk/nextjs";
import type { Metadata } from "next";

import { BackendProfile } from "@/components/backend-profile";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.account };

export default function AccountPage() {
  return (
    <div className="flex flex-1 flex-col items-center gap-8 px-4 py-12">
      <BackendProfile />
      <UserProfile path="/account" />
    </div>
  );
}
