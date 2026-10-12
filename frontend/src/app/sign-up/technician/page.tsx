import type { Metadata } from "next";
import Link from "next/link";

import { AuthLayout } from "@/components/auth/auth-layout";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.signUpTechnician };

export default function TechnicianSignUpPage() {
  return (
    <AuthLayout photo="technician" eyebrow={messages.auth.technicianEyebrow} line={messages.auth.technicianLine} quote={messages.auth.technicianQuote} switchPrompt={messages.auth.haveAccount} switchLabel={messages.auth.signIn} switchHref="/sign-in">
      <div className="w-full space-y-5 rounded-card border border-line bg-surface p-6 text-center shadow-e1">
        <p className="type-body text-ink-2">{messages.auth.technicianBody}</p>
        <Link href="/sign-up" className="inline-flex min-h-11 items-center font-semibold text-orange-text underline underline-offset-4 hover:text-ink">
          {messages.auth.technicianBack}
        </Link>
      </div>
    </AuthLayout>
  );
}
