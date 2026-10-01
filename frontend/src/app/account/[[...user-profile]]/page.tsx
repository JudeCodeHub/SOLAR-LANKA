import { UserProfile } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Account · Solar Lanka" };

export default function AccountPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <UserProfile path="/account" />
    </main>
  );
}
