"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { ConfirmAction } from "@/components/company/confirm-action";
import { StaffGate } from "@/components/company/staff-gate";
import { QueryState } from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { type ApiError } from "@/lib/api/errors";
import { formatLongDate } from "@/lib/catalogue/detail";
import { useCreateInvite, useInvites, useMembers, useRevokeInvite } from "@/lib/company/hooks";
import { format, messages } from "@/messages";

const text = messages.team;

/** The company's team: make one-time technician codes, revoke them, and see who has joined. */
export function TeamView() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.intro} />
      <StaffGate basePath="/company/team">{(company) => <Team companyId={company.company_id} />}</StaffGate>
    </div>
  );
}

function Team({ companyId }: { companyId: string }) {
  const create = useCreateInvite(companyId);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <section aria-labelledby="invite-title" className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-e1 sm:p-6">
        <h2 id="invite-title" className="type-heading text-ink">
          {text.invitesTitle}
        </h2>
        {problem ? <ApiErrorMessage error={problem} /> : null}
        {code ? (
          <div role="status" className="space-y-2 rounded-card border-2 border-orange-text bg-orange-tint p-4" data-new-code>
            <p className="font-medium text-ink">{text.newCodeTitle}</p>
            <p className="font-mono text-3xl font-semibold tracking-widest text-ink">{code}</p>
            <p className="text-sm text-ink-2">{text.newCodeBody}</p>
            <Button type="button" variant="outline" onClick={() => void copy()}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? text.copied : text.copy}
            </Button>
          </div>
        ) : null}
        <Button
          type="button"
          loading={create.isPending}
          onClick={() => {
            setProblem(null);
            setCopied(false);
            create.mutate(undefined, { onSuccess: (made) => setCode(made.code), onError: setProblem });
          }}
        >
          <KeyRound aria-hidden />
          {create.isPending ? text.creating : text.createInvite}
        </Button>
        <Invites companyId={companyId} />
      </section>
      <Members companyId={companyId} />
    </>
  );
}

function Invites({ companyId }: { companyId: string }) {
  const query = useInvites(companyId);
  const revoke = useRevokeInvite(companyId);
  return (
    <QueryState query={query} isEmpty={(rows) => rows.length === 0} empty={<p className="type-body text-ink-2">{text.invitesNone}</p>}>
      {(rows) => (
        <ul className="divide-y divide-line" data-invites>
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="space-y-1">
                <p className="font-mono text-ink">{format(text.invite, { hint: row.code_hint })}</p>
                <p className="text-sm text-ink-2">{format(text.expires, { date: formatLongDate(row.expires_at) ?? row.expires_at })}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={row.status === "active" ? "info" : row.status === "used" ? "success" : "neutral"}>{text.statuses[row.status] ?? row.status}</Badge>
                {row.status === "active" ? (
                  <ConfirmAction id={`revoke-${row.id}`} label={text.revoke} title={text.revokeTitle} body={text.revokeBody} yes={text.revokeYes} keep={text.revokeKeep} disabled={revoke.isPending} onConfirm={() => revoke.mutate(row.id)} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </QueryState>
  );
}

function Members({ companyId }: { companyId: string }) {
  const query = useMembers(companyId);
  return (
    <section aria-labelledby="members-title" className="space-y-3">
      <h2 id="members-title" className="type-heading text-ink">
        {text.membersTitle}
      </h2>
      <QueryState query={query} isEmpty={(rows) => rows.length === 0} empty={<p className="type-body text-ink-2">{text.membersNone}</p>}>
        {(rows) => (
          <ul className="divide-y divide-line rounded-card border border-line bg-surface px-5 shadow-e1" data-members>
            {rows.map((row) => (
              <li key={row.user_id} className="py-3 text-ink">
                {format(text.member, { role: text.roles[row.role] ?? row.role, date: formatLongDate(row.created_at) ?? row.created_at })}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </section>
  );
}
