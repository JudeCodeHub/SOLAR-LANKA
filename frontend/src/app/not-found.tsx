import type { Metadata } from "next";
import Link from "next/link";

import { StateScreen } from "@/components/states/state-screen";
import { Button } from "@/components/ui/button";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.notFound };

export default function NotFound() {
  return (
    <StateScreen
      eyebrow={messages.pages.notFound.eyebrow}
      title={messages.pages.notFound.title}
      description={messages.pages.notFound.message}
      actions={
        <Button asChild>
          <Link href="/">{messages.pages.notFound.home}</Link>
        </Button>
      }
    />
  );
}
