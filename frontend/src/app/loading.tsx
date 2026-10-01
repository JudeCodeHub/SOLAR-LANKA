import { LoadingState } from "@/components/states/loading-state";

/** Shown while a page streams in. Keeps the header and footer in place. */
export default function Loading() {
  return <LoadingState lines={3} className="mx-auto w-full max-w-3xl px-4 py-12" />;
}
