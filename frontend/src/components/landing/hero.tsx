import Link from "next/link";

import { Button } from "@/components/ui/button";
import { messages } from "@/messages";

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="flex flex-col items-center gap-6 py-10 text-center">
      <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
        {messages.landing.hero.title}
      </h1>
      <p className="max-w-2xl text-lg text-muted-foreground">{messages.landing.hero.tagline}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {signedIn ? (
          <Button asChild size="lg">
            <Link href="/account">{messages.landing.hero.goToAccount}</Link>
          </Button>
        ) : (
          <>
            <Button asChild size="lg">
              <Link href="/sign-up">{messages.auth.createAccount}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/sign-in">{messages.auth.signIn}</Link>
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
