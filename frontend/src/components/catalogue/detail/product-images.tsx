import Image from "next/image";

import type { DocumentLink } from "@/lib/catalogue/detail";
import { format, messages } from "@/messages";

/**
 * Photos attached through the verified upload path. Arbitrary image addresses stored on the
 * product are not shown. The images come from the media host, so they are used as given.
 */
export function ProductImages({ images, name }: { images: DocumentLink[]; name: string }) {
  if (images.length === 0) {
    return null;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {images.map((image) => (
        <li key={image.href} className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
          <Image
            src={image.href}
            alt={format(messages.detail.images.alt, { name })}
            fill
            unoptimized
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-contain"
          />
        </li>
      ))}
    </ul>
  );
}
