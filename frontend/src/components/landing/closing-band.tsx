import { ShieldAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Photo } from "@/components/ui/photo";
import { messages } from "@/messages";

const text = messages.landing.story.closing;

/** The last call to action: an orange card inside the page container, sized to sit within one screen, with the sunrise photo fading in from its right. */
export function ClosingBand() {
  return (
    <section aria-labelledby="closing-title" className="flex min-h-svh items-center bg-paper py-section-s" data-closing-band>
      <Container size="landing">
        <div className="relative isolate flex min-h-[min(36rem,76svh)] items-center overflow-hidden rounded-[2rem] bg-orange text-on-orange">
          <div aria-hidden className="absolute inset-y-0 right-0 -z-10 hidden w-3/5 md:block">
            <Photo name="sunrise" sizes="60vw" className="size-full object-cover mix-blend-multiply opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-r from-orange via-orange/60 to-transparent" />
          </div>
          <div className="max-w-xl space-y-6 px-6 py-12 sm:px-12 lg:px-16">
            <h2 id="closing-title" className="type-display-l">{text.title}</h2>
            <p className="type-body max-w-md">{text.body}</p>
            <Button asChild size="lg" className="bg-on-orange text-[#FBF8F3] hover:bg-on-orange/90" data-closing-action>
              <Link href="/estimator">{text.action}</Link>
            </Button>
            <p className="type-small flex max-w-md items-start gap-2 border-t border-on-orange/30 pt-4" data-closing-safety>
              <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                {text.safety}{" "}
                <Link href="/support" className="font-semibold underline underline-offset-4">
                  {text.safetyLink}
                </Link>
              </span>
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
