import type { ElementType, ReactNode } from "react";

const WIDTH = { content: "max-w-content", wide: "max-w-wide", reading: "max-w-reading" } as const;

/** Centres content at one of the three widths with the standard side gutters. */
export function Container({ size = "content", as: Tag = "div", className = "", children }: { size?: keyof typeof WIDTH; as?: ElementType; className?: string; children: ReactNode }) {
  return <Tag className={`mx-auto w-full px-4 sm:px-6 ${WIDTH[size]} ${className}`}>{children}</Tag>;
}
