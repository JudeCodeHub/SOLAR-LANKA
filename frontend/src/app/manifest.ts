import type { MetadataRoute } from "next";

import { BRAND_COLOURS } from "@/lib/brand/logo";
import { messages } from "@/messages";

/** The web app manifest: name, colours and the home-screen icons. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: messages.app.name,
    short_name: messages.app.name,
    description: messages.app.description,
    start_url: "/",
    display: "standalone",
    background_color: BRAND_COLOURS.light.background,
    theme_color: BRAND_COLOURS.light.background,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
