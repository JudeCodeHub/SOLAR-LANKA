import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { StateScreen } from "@/components/states/state-screen";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.dashboard };

const text = messages.pages.dashboardUnavailable;

export default async function DashboardPage() {
  const current = await getCurrentUser();
  if (current.status === "signed-out") redirect("/sign-in");
  if (current.status === "ready") redirect(current.home);
  // The API could not say who this is: show a plain retry instead of guessing an area or looping.
  return (
    <StateScreen
      alert
      tone="danger"
      eyebrow={text.eyebrow}
      title={text.title}
      description={text.message}
      actions={
        <>
          <Button asChild>
            <Link href="/dashboard">{text.retry}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">{text.home}</Link>
          </Button>
        </>
      }
    />
  );
}
