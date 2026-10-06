"use client";

import Image, { type ImageLoaderProps } from "next/image";

import { PHOTO_FILES } from "@/lib/photos/manifest";
import { PHOTOS, type PhotoKey } from "@/lib/photos/photos";
import { cn } from "@/lib/utils";
import { messages } from "@/messages";

/** Serve the smallest prepared file that is at least as wide as the screen asks for. */
function loader({ src, width }: ImageLoaderProps): string {
  const widths = PHOTO_FILES[src]?.widths ?? [];
  const chosen = widths.find((candidate) => candidate >= width) ?? widths.at(-1) ?? width;
  return `/photos/${src}-${chosen}.webp`;
}

/** A photo from the set with a blurred placeholder, eased down a little in the dark theme so it does not glare; a warm gradient of the same shape stands in when the file is missing. */
export function Photo({ name, sizes, priority = false, className = "" }: { name: PhotoKey; sizes: string; priority?: boolean; className?: string }) {
  const file = PHOTOS[name];
  const entry = PHOTO_FILES[file];
  const alt = messages.photos.alt[name] ?? "";
  if (!entry) {
    return <div role="img" aria-label={alt} className={`aspect-[3/2] bg-gradient-to-br from-orange-tint to-paper-2 ${className}`} />;
  }
  return <Image loader={loader} src={file} width={entry.width} height={entry.height} alt={alt} sizes={sizes} priority={priority} {...(priority ? { fetchPriority: "high" as const, loading: "eager" as const } : {})} placeholder="blur" blurDataURL={entry.blur} className={cn("dark:brightness-90", className)} />;
}
