import Link from "next/link";
import type { ReactNode } from "react";

import { StatePanel } from "@/components/states/state-panel";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { Persona } from "@/lib/navigation";
import { messages } from "@/messages";
import { Lock } from "lucide-react";

const text = messages.shell.notAllowed;

/** Server-side role check for one area; when the API cannot say who the person is, the page's own gate and the API decide. */
export async function AreaGuard({ allow, children }: { allow: readonly Persona[]; children: ReactNode }) {
  const current = await getCurrentUser();
  if (current.status === "ready" && !allow.includes(current.persona)) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-16 sm:px-6" data-area-guard>
        <StatePanel
          icon={Lock}
          heading="h1"
          title={text.title}
          description={text.message}
          action={
            <Button asChild>
              <Link href={current.home}>{text.action}</Link>
            </Button>
          }
          className="w-full"
        />
      </div>
    );
  }
  return <>{children}</>;
}
