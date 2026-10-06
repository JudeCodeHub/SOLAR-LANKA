import { UserProfile } from "@clerk/nextjs";
import type { Metadata } from "next";

import { BackendProfile } from "@/components/backend-profile";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.account };

const text = messages.account;

/** The account page: the application's own record (role, created) above Clerk's profile, which manages the sign-in details. */
export default function AccountPage() {
  return (
    <Section space="m" labelledBy="account-title">
      <Container size="content" className="space-y-10" data-account-page>
        <PageHeader eyebrow={text.eyebrow} title={text.title} titleId="account-title" description={text.lead} />
        <BackendProfile />
        <section aria-labelledby="sign-in-details-title" className="space-y-4">
          <h2 id="sign-in-details-title" className="type-heading text-ink">{text.signInDetails}</h2>
          <p className="type-body max-w-2xl text-ink-2">{text.signInDetailsLead}</p>
          <div data-clerk-profile>
            <UserProfile path="/account" appearance={{ elements: { rootBox: "w-full!", cardBox: "w-full! max-w-none! rounded-card! border! border-line! shadow-e2!" } }} />
          </div>
        </section>
      </Container>
    </Section>
  );
}
