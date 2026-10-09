import Link from "next/link";
import type { ReactNode } from "react";

import { LogoMark } from "@/components/brand/logo";
import { Photo } from "@/components/ui/photo";
import { photoUrl } from "@/lib/photos/url";
import { messages } from "@/messages";

/** The frame for sign-in and sign-up: on the left a photo seen through the landing page's gliding diamond windows, with the brand and a sentence for this page fading in at the bottom, and on the right one centred column with the heading, a one-line subtitle, the form and the link to the other page; on a phone the photo becomes a strip above the column. */
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
      <div className="relative hidden overflow-hidden bg-paper lg:order-1 lg:block" data-auth-photo>
        <div aria-hidden className="absolute inset-0" style={{ "--lattice-photo": `url(${photoUrl(photo, 1440)})` } as React.CSSProperties}>
          <div className="lattice">
            <div className="lattice-layer" data-run="rise" />
            <div className="lattice-layer" data-run="sink" />
          </div>
        </div>
        <div aria-hidden className="absolute inset-x-0 top-0 h-1/6 bg-gradient-to-b from-paper to-transparent" />
        <div aria-hidden className="absolute inset-y-0 right-0 w-1/6 bg-gradient-to-l from-paper to-transparent" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-paper via-paper/85 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-5 p-12 pr-24 text-ink">
          <Link href="/" className="inline-flex items-center gap-3" aria-label={messages.app.name} data-auth-brand>
            <LogoMark size={44} />
            <span className="font-heading text-2xl font-semibold tracking-tight">{messages.app.name}</span>
          </Link>
          <p className="footer-lede max-w-md">{quote}</p>
        </div>
      </div>
    </div>
  );
}
