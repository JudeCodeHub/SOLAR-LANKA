import type { Metadata } from "next";
import { Suspense } from "react";

import { FavouritesView } from "@/components/favourites/favourites-view";
import { LoadingState } from "@/components/states/loading-state";
import { messages } from "@/messages";

export const metadata: Metadata = { title: messages.titles.favourites };

export default function FavouritesPage() {
  return (
    // useSearchParams (the page number) needs a Suspense boundary.
    <Suspense fallback={<LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />}>
      <FavouritesView />
    </Suspense>
  );
}
