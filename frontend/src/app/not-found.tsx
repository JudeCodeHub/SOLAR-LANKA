import type { Metadata } from "next";
import Link from "next/link";

import { NotFoundState } from "@/components/states/not-found-state";
import { Button } from "@/components/ui/button";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.notFound };

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16">
      <NotFoundState
        title={messages.pages.notFound.title}
        description={messages.pages.notFound.message}
        action={
          <Button asChild>
            <Link href="/">{messages.pages.notFound.home}</Link>
          </Button>
        }
      />
    </div>
  );
}
