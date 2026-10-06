import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Photo } from "@/components/ui/photo";
import { messages } from "@/messages";

const text = messages.landing.story.closing;

/** The last call to action: a full-width orange band with the sunrise photo fading in from the right, joined straight onto the footer. Its ink stays dark in both themes, like every other text on orange. */
export function ClosingBand() {
  return (
    <section aria-labelledby="closing-title" className="relative isolate overflow-hidden bg-orange text-on-orange" data-closing-band>
      <div aria-hidden className="absolute inset-y-0 right-0 -z-10 hidden w-3/5 md:block">
        <Photo name="sunrise" sizes="60vw" className="size-full object-cover mix-blend-multiply opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-r from-orange via-orange/60 to-transparent" />
      </div>
      <Container size="content" className="py-section-l">
        <div className="max-w-xl space-y-6">
          <h2 id="closing-title" className="type-display-l">{text.title}</h2>
          <p className="type-body max-w-md">{text.body}</p>
          <Button asChild size="lg" className="bg-on-orange text-[#FBF8F3] hover:bg-on-orange/90" data-closing-action>
            <Link href="/estimator">{text.action}</Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
