"use client";

import { PageHeader } from "@/components/ui/page-header";
import { NextSteps, StatTile, SummaryCard } from "@/components/dashboard/dashboard-parts";
import { Building2, Users } from "lucide-react";

import { ReviewBanner } from "@/components/company/review-banner";
import { StaffGate } from "@/components/company/staff-gate";
import { QueryState } from "@/components/query-state";
import { useCompanyProfile } from "@/lib/company/hooks";
import { companyActions } from "@/lib/dashboard/dashboard";
import { useDashboardInbox, useDashboardInstallations } from "@/lib/dashboard/hooks";
import { useUnreadCount } from "@/lib/notifications/hooks";
import { useOffers } from "@/lib/offers/hooks";
import { format, messages } from "@/messages";

const text = messages.dashboard.company;
const tiles = text.tiles;
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
      {profile.data ? <ReviewBanner profile={profile.data} /> : null}
      <section aria-labelledby="tiles-title" className="space-y-3">
        <h2 id="tiles-title" className="type-heading text-ink">
          {tiles.title}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile id="enquiries" label={tiles.enquiries.label} figure={fresh} note={format(tiles.enquiries.note, { total: inbox.data?.total ?? 0 })} href={`/company/inbox?company=${companyId}`} open={tiles.enquiries.open} attention={(fresh ?? 0) > 0} />
          <StatTile id="installations" label={tiles.installations.label} figure={active} note={format(tiles.installations.note, { total: installations.data?.total ?? 0 })} href={`/company/installations?company=${companyId}`} open={tiles.installations.open} attention={false} />
          <StatTile id="offers" label={tiles.offers.label} figure={offers.data?.length} note={tiles.offers.note} href="/company/offers" open={tiles.offers.open} attention={offers.data?.length === 0} />
          <StatTile id="unread" label={tiles.unread.label} figure={unread.data} note={tiles.unread.note} href="/notifications?filter=unread" open={tiles.unread.open} attention={(unread.data ?? 0) > 0} />
        </div>
      </section>
      <NextSteps actions={actions} partial={partial} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard id="profile" icon={Building2} title={text.profileTitle} link={{ href: `/company/profile?company=${companyId}`, label: messages.nav.items.companyProfile }}>
          <QueryState query={profile}>
            {(data) => <p>{format(text.profileLine, { status: profileStatuses[data.publication_status]?.label ?? data.publication_status })}</p>}
          </QueryState>
        </SummaryCard>
        <SummaryCard id="team" icon={Users} title={tiles.teamTitle} link={{ href: `/company/team?company=${companyId}`, label: tiles.teamOpen }}>
          <p>{tiles.teamLine}</p>
        </SummaryCard>
      </div>
    </>
  );
}
