import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.signIn };

export default function SignInPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <SignIn />
    </div>
  );
}
