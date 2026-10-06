import { Eye, OctagonAlert, Phone } from "lucide-react";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Photo } from "@/components/ui/photo";
import { Section } from "@/components/ui/section";
import { messages } from "@/messages";

const text = messages.landing.story.safety;
const guidance = messages.troubleshooting;

/** Safety and troubleshooting: the rule comes first, before any invitation to look something up. */
export function SafetySection() {
  return (
    <Section space="l" labelledBy="safety-title">
      <Container size="content" className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16" data-safety-section>
        <div className="order-2 overflow-hidden rounded-panel border border-line shadow-e2 lg:order-1">
          <Photo name="safetyVisit" sizes="(min-width: 1024px) 45vw, 100vw" className="aspect-[4/3] w-full object-cover" />
        </div>
        <div className="order-1 space-y-6 lg:order-2">
          <p className="type-caption font-semibold tracking-widest text-danger uppercase">{text.eyebrow}</p>
          <h2 id="safety-title" className="type-display-m text-ink">{text.title}</h2>
          <Alert variant="hazard" role="note" data-safety-rule>
            <OctagonAlert aria-hidden />
            <div className="space-y-1">
              <p>{guidance.hazardTitle}</p>
              <p>{guidance.hazardEscalate}</p>
            </div>
          </Alert>
          <p className="type-body text-ink-2">{text.body}</p>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 text-ink-2">
              <Eye aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-3" />
              <span className="type-small">{text.lookTip}</span>
            </li>
            <li className="flex items-start gap-3 text-ink-2">
              <Phone aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-3" />
              <span className="type-small">{text.callTip}</span>
            </li>
          </ul>
          <Button asChild variant="outline" size="lg">
            <Link href="/troubleshooting">{text.action}</Link>
          </Button>
        </div>
      </Container>
    </Section>
  );
}
