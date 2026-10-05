import { BadgeCheck, Clock, FlaskConical, Info, type LucideIcon, Sun, Tag, TriangleAlert, CircleCheck } from "lucide-react";
import * as React from "react";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

/** Every badge shows an icon and a word, so its meaning never depends on colour alone. */
const badgeVariants = cva("inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs leading-none font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0", {
  variants: {
    variant: {
      neutral: "border-line bg-paper-2 text-ink-2",
      orange: "border-orange-text/30 bg-orange-tint text-orange-text",
      success: "border-success/30 bg-success-tint text-success",
      warning: "border-warning/35 bg-warning-tint text-warning",
      danger: "border-danger/35 bg-danger-tint text-danger",
      info: "border-info/30 bg-info-tint text-info",
    },
  },
  defaultVariants: { variant: "neutral" },
});

type Variant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const ICONS: Record<Variant, LucideIcon> = { neutral: Tag, orange: Sun, success: CircleCheck, warning: Clock, danger: TriangleAlert, info: Info };

function Badge({ variant = "neutral", icon, className, children, ...props }: Omit<React.ComponentProps<"span">, "children"> & VariantProps<typeof badgeVariants> & { icon?: LucideIcon; children: React.ReactNode }) {
  const Icon = icon ?? ICONS[variant ?? "neutral"];
  return (
    <span data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props}>
      <Icon aria-hidden />
      {children}
    </span>
  );
}

/** Content that is a demonstration sample, not real. */
function SampleBadge({ children, ...props }: Omit<React.ComponentProps<"span">, "children"> & { children: React.ReactNode }) {
  return (
    <Badge variant="info" icon={FlaskConical} {...props}>
      {children}
    </Badge>
  );
}

/** Content whose claims were checked against its sources. */
function VerifiedBadge({ children, ...props }: Omit<React.ComponentProps<"span">, "children"> & { children: React.ReactNode }) {
  return (
    <Badge variant="success" icon={BadgeCheck} {...props}>
      {children}
    </Badge>
  );
}

/** Content that depends on rules or prices that can change. */
function TimeSensitiveBadge({ children, ...props }: Omit<React.ComponentProps<"span">, "children"> & { children: React.ReactNode }) {
  return (
    <Badge variant="warning" icon={Clock} {...props}>
      {children}
    </Badge>
  );
}

export { Badge, badgeVariants, SampleBadge, TimeSensitiveBadge, VerifiedBadge };
