import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.signUp };

export default function SignUpPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-12">
      <SignUp />
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        {messages.auth.customerOnlyNote}
      </p>
    </div>
  );
}
