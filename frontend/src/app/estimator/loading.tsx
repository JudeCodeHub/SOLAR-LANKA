import { PageSkeleton } from "@/components/states/page-skeleton";

/** Shown while the estimator loads. */
export default function Loading() {
  return <PageSkeleton variant="form" />;
}
