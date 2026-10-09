import { PageSkeleton } from "@/components/states/page-skeleton";

/** Shown while the panel list loads. */
export default function Loading() {
  return <PageSkeleton variant="cards" />;
}
