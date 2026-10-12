import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AuthLayout } from "@/components/auth/auth-layout";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.signUpTechnician };

export default function TechnicianSignUpPage() {
  return (
    <AuthLayout photo="technician" eyebrow={messages.auth.technicianEyebrow} line={messages.auth.technicianLine} quote={messages.auth.technicianQuote} switchPrompt={messages.auth.haveAccount} switchLabel={messages.auth.signIn} switchHref="/sign-in">
      <div className="w-full space-y-4">
        <p className="type-body text-center text-ink-2">{messages.auth.technicianBody}</p>
        <div className="flex justify-center">
          <SignUp path="/sign-up/technician" routing="path" signInUrl="/sign-in" forceRedirectUrl="/my/join-company" />
        </div>
      </div>
    </AuthLayout>
  );
}
