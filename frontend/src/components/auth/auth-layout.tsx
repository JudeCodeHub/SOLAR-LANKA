import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { Dial } from "@/components/ui/dial";
import { Photo } from "@/components/ui/photo";
import { SampleBadge } from "@/components/ui/badge";
import { messages } from "@/messages";

const text = messages.auth.layout;

/** The frame for sign-in and sign-up: the form on one side, a photo with a sample dial on the other; on a phone the photo becomes a strip above a single column. */
export function AuthLayout({ photo, eyebrow, line, children }: { photo: "signIn" | "signUp"; eyebrow: string; line: string; children: ReactNode }) {
  return (
    <div className="grid flex-1 lg:grid-cols-2" data-auth-layout>
      <div className="relative h-36 overflow-hidden sm:h-48 lg:hidden">
        <Photo name={photo} sizes="100vw" priority className="absolute inset-0 size-full object-cover" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>
      <div className="flex items-start justify-center px-4 py-10 sm:px-6 lg:items-center lg:py-16">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center lg:text-left">
            <p className="type-caption font-semibold tracking-widest text-orange-text uppercase">{eyebrow}</p>
            <p className="type-body text-ink-2">{line}</p>
          </div>
          <div className="flex justify-center lg:justify-start" data-auth-form>
            {children}
          </div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden lg:block" data-auth-photo>
        <Photo name={photo} sizes="50vw" priority className="absolute inset-0 size-full object-cover" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent" />
        <Card variant="glass" className="absolute right-8 bottom-8 w-80 flex-row items-center gap-4 p-3">
          <Dial label={text.dialLabel} value={5.4} max={15} unit={text.dialUnit} size={96} />
          <div className="space-y-2">
            <SampleBadge>{text.sample}</SampleBadge>
            <p className="type-small text-ink-2">{text.dialNote}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
