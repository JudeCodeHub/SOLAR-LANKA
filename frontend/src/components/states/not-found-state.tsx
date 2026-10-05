import { Compass } from "lucide-react";
import type { ReactNode } from "react";

import { StatePanel } from "@/components/states/state-panel";

/** The not-found convention: the page heading, a plain explanation and a way back. */
export function NotFoundState({
  title,
  description,
  action,
  illustration,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  illustration?: ReactNode;
  className?: string;
}) {
  return <StatePanel icon={Compass} heading="h1" illustration={illustration} title={title} description={description} action={action} className={className} />;
}
