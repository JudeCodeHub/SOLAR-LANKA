import { SignUp } from "@clerk/nextjs";
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
      quote={messages.auth.signUpQuote}
      switchPrompt={messages.auth.haveAccount}
      switchLabel={messages.auth.signIn}
      switchHref="/sign-in"
    >
      <SignUp />
    </AuthLayout>
  );
}
