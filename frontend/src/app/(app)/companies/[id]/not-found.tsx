import Link from "next/link";

import { StateScreen } from "@/components/states/state-screen";
import { Button } from "@/components/ui/button";
import { messages } from "@/messages";

export default function NotFound() {
  return (
    <StateScreen
      eyebrow={messages.pages.notFound.eyebrow}
      title={messages.directory.notFound.title}
      description={messages.directory.notFound.message}
      actions={
        <Button asChild>
          <Link href="/companies">{messages.directory.profile.back}</Link>
        </Button>
      }
    />
  );
}
