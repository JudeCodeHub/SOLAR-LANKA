import Link from "next/link";
import type { ReactNode } from "react";

import { AuthPhotoSide } from "@/components/auth/auth-photo-side";
import { Photo } from "@/components/ui/photo";

/** The frame for sign-in and sign-up: on the left a warm wall with a house that draws itself and fills its roof with panels (see AuthPhotoSide), with the brand and a sentence for this page, and on the right one centred column with the heading, a one-line subtitle, the form and the link to the other page; on a phone the photo becomes a strip above the column. */
export function AuthLayout({ photo, eyebrow, line, quote, switchPrompt, switchLabel, switchHref, children }: { photo: "signIn" | "signUp"; eyebrow: string; line: string; quote: string; switchPrompt: string; switchLabel: string; switchHref: string; children: ReactNode }) {
  return (
    <div className="grid flex-1 lg:grid-cols-2" data-auth-layout>
      <div className="relative h-36 overflow-hidden sm:h-48 lg:hidden">
        <Photo name={photo} sizes="100vw" priority className="absolute inset-0 size-full scale-105 object-cover blur-[2px]" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-paper to-transparent" />
      </div>
      <div className="flex items-start justify-center px-4 py-10 sm:px-6 lg:order-2 lg:items-center lg:px-12 lg:py-16">
        <div className="w-full max-w-lg space-y-6">
          <div className="space-y-3 text-center">
            <h1 className="type-display-m text-ink">{eyebrow}</h1>
            <p className="type-body text-ink-2 lg:whitespace-nowrap">{line}</p>
          </div>
          <div className="auth-clerk flex justify-center" data-auth-form>
            {children}
          </div>
          <p className="text-center text-base text-ink-2" data-auth-switch>
            {switchPrompt}{" "}
            <Link href={switchHref} className="inline-flex min-h-11 items-center font-semibold text-orange-text underline underline-offset-4 hover:text-ink">
              {switchLabel}
            </Link>
          </p>
        </div>
      </div>
      <AuthPhotoSide photo={photo} quote={quote} />
    </div>
  );
}
