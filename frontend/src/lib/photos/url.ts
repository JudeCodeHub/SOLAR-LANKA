import { PHOTO_FILES } from "./manifest.ts";
import { PHOTOS, type PhotoKey } from "./photos.ts";

/** The address of the smallest prepared file of a photo that is at least `width` wide, for photos used as a background. */
export function photoUrl(name: PhotoKey, width: number): string {
  const file = PHOTOS[name];
  const widths = PHOTO_FILES[file]?.widths ?? [];
  const chosen = widths.find((candidate) => candidate >= width) ?? widths.at(-1) ?? width;
  return `/photos/${file}-${chosen}.webp`;
}
