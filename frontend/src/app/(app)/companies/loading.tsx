import { PageSkeleton } from "@/components/states/page-skeleton";

/** Shown while the company directory loads. */
export default function Loading() {
  return <PageSkeleton variant="cards" />;
}
