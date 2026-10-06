"use client";

import { PageHeader } from "@/components/ui/page-header";
import { NextSteps, SummaryCard } from "@/components/dashboard/dashboard-parts";
import { Building2, FileText, Inbox, Wrench } from "lucide-react";

import { StaffGate } from "@/components/company/staff-gate";
import { QueryState } from "@/components/query-state";
import { useCompanyProfile } from "@/lib/company/hooks";
import { companyActions } from "@/lib/dashboard/dashboard";
import { useDashboardInbox, useDashboardInstallations } from "@/lib/dashboard/hooks";
import { useUnreadCount } from "@/lib/notifications/hooks";
import { useOffers } from "@/lib/offers/hooks";
import { format, messages, plural } from "@/messages";

const text = messages.dashboard.company;
const profileStatuses = messages.company.profile.status as unknown as Record<string, { label: string }>;

/** The company's home: what needs attention across its profile, enquiries, offers and installations. */
export function CompanyDashboard() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <StaffGate basePath="/company">{(company) => <Dashboard companyId={company.company_id} name={company.company_name} />}</StaffGate>
    </div>
  );
}

function Dashboard({ companyId, name }: { companyId: string; name: string }) {
  const profile = useCompanyProfile(companyId);
  const inbox = useDashboardInbox(companyId);
  const installations = useDashboardInstallations(companyId);
  const offers = useOffers(companyId);
  const unread = useUnreadCount();

  const fresh = inbox.data ? inbox.data.items.filter((item) => item.status === "submitted").length : undefined;
  const active = installations.data ? installations.data.items.filter((item) => item.completed_milestones < item.total_milestones).length : undefined;
  const actions = companyActions(
    {
      profileStatus: profile.data?.publication_status,
      newEnquiries: fresh,
      installationsInProgress: active,
      offerCount: offers.data?.length,
      unread: unread.data,
    },
    companyId,
  );
  const partial = profile.isError || inbox.isError || installations.isError || offers.isError || unread.isError;

  return (
    <>
      <p className="inline-flex min-h-8 w-fit items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink" data-company-name>
        <Building2 aria-hidden className="size-4 text-orange-text" />
        {name}
      </p>
      <NextSteps actions={actions} partial={partial} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard id="profile" icon={Building2} title={text.profileTitle} link={{ href: `/company/profile?company=${companyId}`, label: messages.nav.items.companyProfile }}>
          <QueryState query={profile}>
            {(data) => <p>{format(text.profileLine, { status: profileStatuses[data.publication_status]?.label ?? data.publication_status })}</p>}
          </QueryState>
        </SummaryCard>
        <SummaryCard id="inbox" icon={Inbox} figure={inbox.data ? String(inbox.data.total) : undefined} title={text.inboxTitle} link={{ href: `/company/inbox?company=${companyId}`, label: messages.nav.items.companyInbox }}>
          <QueryState query={inbox} isEmpty={(result) => result.total === 0} empty={<p data-empty>{text.inboxNone}</p>}>
            {(result) => <p>{format(plural(text.inboxLine, result.total), { count: result.total, fresh: fresh ?? 0 })}</p>}
          </QueryState>
        </SummaryCard>
        <SummaryCard id="installations" icon={Wrench} figure={installations.data ? String(installations.data.total) : undefined} title={text.installationsTitle} link={{ href: `/company/installations?company=${companyId}`, label: messages.nav.items.companyInstallations }}>
          <QueryState query={installations} isEmpty={(result) => result.total === 0} empty={<p data-empty>{text.installationsNone}</p>}>
            {(result) => <p>{format(plural(text.installationsLine, result.total), { count: result.total, active: active ?? 0 })}</p>}
          </QueryState>
        </SummaryCard>
        <SummaryCard id="offers" icon={FileText} figure={offers.data ? String(offers.data.length) : undefined} title={text.offersTitle} link={{ href: "/company/offers", label: messages.nav.items.companyOffers }}>
          <QueryState query={offers} isEmpty={(result) => result.length === 0} empty={<p data-empty>{text.offersNone}</p>}>
            {(result) => <p>{format(plural(text.offersLine, result.length), { count: result.length })}</p>}
          </QueryState>
        </SummaryCard>
      </div>
    </>
  );
}
