import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { StatePanel } from "@/components/states/state-panel";

/** The error convention: a danger-toned panel announced to screen readers, with a way to try again. */
export function ErrorState({
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
  return <StatePanel role="alert" icon={TriangleAlert} tone="danger" illustration={illustration} title={title} description={description} action={action} className={className} />;
}
