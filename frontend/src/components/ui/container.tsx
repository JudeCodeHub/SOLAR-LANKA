import type { ElementType, ReactNode } from "react";

const WIDTH = { content: "max-w-content", wide: "max-w-wide", landing: "max-w-landing", reading: "max-w-reading" } as const;

/** Centres content at one of the three widths with the standard side gutters. */
export function Container({ size = "content", as: Tag = "div", className = "", children, ...rest }: { size?: keyof typeof WIDTH; as?: ElementType; className?: string; children: ReactNode } & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <Tag className={`mx-auto w-full px-4 sm:px-6 ${WIDTH[size]} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
