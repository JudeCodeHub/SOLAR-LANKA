"use client";

import { CircleCheck, Clock3, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api/errors";
import { type CompanyProfile, useSubmitProfile } from "@/lib/company/hooks";
import { canSubmit } from "@/lib/company/profile";
import { messages } from "@/messages";

const text = messages.dashboard.company.review;
const status = messages.company.profile.status;

/** Where the company stands with the platform review, with the button to submit it; nothing is shown once it is approved. */
export function ReviewBanner({ profile }: { profile: CompanyProfile }) {
  const submit = useSubmitProfile(profile.id);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const current = profile.publication_status;
  if (current === "approved") return null;

  const title = current === "pending" ? text.pendingTitle : current === "rejected" ? text.rejectedTitle : text.draftTitle;
  const Icon = current === "pending" ? Clock3 : current === "rejected" ? TriangleAlert : CircleCheck;
  return (
    <section aria-labelledby="review-title" className="space-y-3 rounded-card border-2 border-orange-text bg-orange-tint p-5 shadow-e1 sm:p-6" data-review-banner={current}>
      <h2 id="review-title" className="type-heading flex items-center gap-2 text-ink">
        <Icon aria-hidden className="size-5 shrink-0 text-orange-text" />
        {title}
      </h2>
      <p className="type-body text-ink">{status[current].body}</p>
      <p className="text-sm text-ink-2">{text.cannotReceive}</p>
      {problem ? <ApiErrorMessage error={problem} /> : null}
      <div className="flex flex-wrap gap-3">
        {canSubmit(current) ? (
          <Button type="button" loading={submit.isPending} onClick={() => { setProblem(null); submit.mutate(undefined, { onError: setProblem }); }}>
            {submit.isPending ? text.working : current === "rejected" ? text.resubmit : text.submit}
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href={`/company/profile?company=${profile.id}`}>{text.edit}</Link>
        </Button>
      </div>
    </section>
  );
}
