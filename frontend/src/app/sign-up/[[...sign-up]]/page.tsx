import { SignUp } from "@clerk/nextjs";
import { BookmarkCheck, Route, Send } from "lucide-react";
import type { Metadata } from "next";

import { AuthLayout } from "@/components/auth/auth-layout";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.signUp };

export default function SignUpPage() {
  return (
    <AuthLayout
      photo="signUp"
      eyebrow={messages.auth.signUpEyebrow}
      line={messages.auth.signUpLine}
      points={[
        { icon: BookmarkCheck, text: messages.auth.signUpPoints.save },
        { icon: Send, text: messages.auth.signUpPoints.ask },
        { icon: Route, text: messages.auth.signUpPoints.follow },
      ]}
    >
      <div className="flex flex-col items-center gap-4 lg:items-start">
        <SignUp />
        <p className="max-w-sm text-center text-sm text-ink-2 lg:text-left">{messages.auth.customerOnlyNote}</p>
      </div>
    </AuthLayout>
  );
}
