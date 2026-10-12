import { ArrowRight, Building2, HardHat, Home } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.signUp };

const text = messages.auth;
const CHOICES = [
  { id: "customer", href: "/sign-up/customer", icon: Home },
  { id: "company", href: "/sign-up/company", icon: Building2 },
  { id: "technician", href: "/sign-up/technician", icon: HardHat },
] as const;

/** One centred page: the brand, the question, then the three ways in as wide cards that fill with orange from the left as you point at them. */
export default function SignUpChoicePage() {
  return (
    <div className="relative isolate flex flex-1 flex-col items-center overflow-hidden px-4 py-10 sm:px-6 sm:py-16">
      <div aria-hidden className="pointer-events-none absolute top-0 left-1/2 -z-10 aspect-square w-[min(60rem,140%)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange/15 blur-3xl" />
      <Link href="/" className="inline-flex items-center gap-3 text-ink" aria-label={messages.app.name}>
        <LogoMark size={44} />
        <span className="font-heading text-2xl font-semibold tracking-tight">{messages.app.name}</span>
      </Link>
      <div className="my-auto w-full max-w-2xl space-y-8 py-10">
        <div className="space-y-3 text-center">
          <h1 className="type-display-m text-ink">{text.chooseEyebrow}</h1>
          <p className="type-body text-ink-2">{text.chooseLine}</p>
        </div>
        <ul className="space-y-4">
          {CHOICES.map(({ id, href, icon: Icon }) => (
            <li key={id}>
              <Link href={href} className="group relative isolate flex min-h-11 items-center gap-5 overflow-hidden rounded-2xl border border-line bg-surface p-6 text-left shadow-e1 transition-[color,border-color,box-shadow] duration-300 hover:border-orange hover:text-on-orange hover:shadow-e2 focus-visible:border-orange motion-reduce:transition-none sm:p-7" data-choice={id}>
                <span aria-hidden className="absolute inset-0 -z-10 origin-left scale-x-0 bg-orange transition-transform duration-500 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none" />
                <span className="grid size-14 shrink-0 place-items-center rounded-full bg-orange-tint text-orange-text">
                  <Icon aria-hidden className="size-7" />
                </span>
                <span className="flex-1 space-y-1">
                  <span className="block font-heading text-xl font-semibold text-ink group-hover:text-on-orange group-focus-visible:text-on-orange">{text.chooseOptions[id].title}</span>
                  <span className="block text-sm text-ink-2 group-hover:text-on-orange group-focus-visible:text-on-orange">{text.chooseOptions[id].body}</span>
                </span>
                <ArrowRight aria-hidden className="size-6 shrink-0 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-center text-base text-ink-2">
          {text.haveAccount}{" "}
          <Link href="/sign-in" className="inline-flex min-h-11 items-center font-semibold text-orange-text underline underline-offset-4 hover:text-ink">
            {text.signIn}
          </Link>
        </p>
      </div>
    </div>
  );
}
