import { SignIn } from "@clerk/nextjs";
import { Calculator, HardHat, Inbox } from "lucide-react";
import type { Metadata } from "next";

import { AuthLayout } from "@/components/auth/auth-layout";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.signIn };

export default function SignInPage() {
  return (
    <AuthLayout
      photo="signIn"
      eyebrow={messages.auth.signInEyebrow}
      line={messages.auth.signInLine}
      points={[
        { icon: Calculator, text: messages.auth.signInPoints.estimates },
        { icon: Inbox, text: messages.auth.signInPoints.requests },
        { icon: HardHat, text: messages.auth.signInPoints.installations },
      ]}
    >
      <SignIn />
    </AuthLayout>
  );
}
