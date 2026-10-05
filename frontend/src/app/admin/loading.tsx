import { PageSkeleton } from "@/components/states/page-skeleton";

/** Shown while an administration page loads, inside the area frame. */
export default function Loading() {
  return <PageSkeleton variant="table" />;
}
