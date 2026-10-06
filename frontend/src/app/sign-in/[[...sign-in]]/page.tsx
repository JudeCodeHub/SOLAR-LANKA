import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AuthLayout } from "@/components/auth/auth-layout";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.signIn };

export default function SignInPage() {
  return (
    <AuthLayout photo="signIn" eyebrow={messages.auth.signInEyebrow} line={messages.auth.signInLine}>
      <SignIn />
    </AuthLayout>
  );
}
