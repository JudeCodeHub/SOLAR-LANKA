import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AuthLayout } from "@/components/auth/auth-layout";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.signUpCompany };

export default function CompanySignUpPage() {
  return (
    <AuthLayout photo="company" eyebrow={messages.auth.companyEyebrow} line={messages.auth.companyLine} quote={messages.auth.companyQuote} switchPrompt={messages.auth.haveAccount} switchLabel={messages.auth.signIn} switchHref="/sign-in">
      <SignUp path="/sign-up/company" routing="path" signInUrl="/sign-in" />
    </AuthLayout>
  );
}
