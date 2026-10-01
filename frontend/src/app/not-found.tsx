import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.notFound };

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        {messages.pages.notFound.title}
      </h1>
      <p className="text-muted-foreground">{messages.pages.notFound.message}</p>
      <Button asChild>
        <Link href="/">{messages.pages.notFound.home}</Link>
      </Button>
    </div>
  );
}
