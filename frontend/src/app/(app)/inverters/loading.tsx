import { PageSkeleton } from "@/components/states/page-skeleton";

/** Shown while the inverter list loads. */
export default function Loading() {
  return <PageSkeleton variant="cards" />;
}
