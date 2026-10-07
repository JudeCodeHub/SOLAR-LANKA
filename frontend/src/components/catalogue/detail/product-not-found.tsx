import Link from "next/link";

import { Button } from "@/components/ui/button";
import { messages } from "@/messages";

/** Shown for an unknown, retired or malformed product address. */
export function ProductNotFound({ listHref, label }: { listHref: string; label: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        {messages.detail.notFound.title}
      </h1>
      <p className="text-ink-3">{messages.detail.notFound.message}</p>
      <Button asChild>
        <Link href={listHref}>{label}</Link>
      </Button>
    </div>
  );
}
