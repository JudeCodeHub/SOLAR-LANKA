import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const TONES: Record<"success" | "error" | "info" | "warning", { icon: LucideIcon; color: string; role: "status" | "alert" }> = {
  success: { icon: CircleCheck, color: "text-success", role: "status" },
  info: { icon: Info, color: "text-info", role: "status" },
  warning: { icon: TriangleAlert, color: "text-warning", role: "alert" },
  error: { icon: CircleAlert, color: "text-danger", role: "alert" },
};

/** A short result of something the person just did, written in the page where it happened: an icon, the words in full-strength text, and a polite status (or an urgent alert for a problem) so screen readers announce it. */
export function StatusNote({ tone, children, className, ...rest }: { tone: "success" | "error" | "info" | "warning"; children: ReactNode; className?: string } & Omit<React.ComponentProps<"p">, "children" | "className" | "role">) {
  const { icon: Icon, color, role } = TONES[tone];
  return (
    <p data-slot="status-note" data-tone={tone} role={role} className={cn("flex items-start gap-2 text-sm font-medium text-ink", className)} {...rest}>
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", color)} />
      <span>{children}</span>
    </p>
  );
}
