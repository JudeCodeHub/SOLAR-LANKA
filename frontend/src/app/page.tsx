import { ClosingBand } from "@/components/landing/closing-band";
import { ComparisonSection } from "@/components/landing/comparison-section";
import { EstimateTeaser } from "@/components/landing/estimate-teaser";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth/server";

/** The landing page: six sections (hero, a sample estimate, how it works, what you can do, a quotation comparison and a closing call to action) for visitors who are not signed in; it needs no data from the API, so it opens even when the backend is down. */
export default async function Home() {
  // Like any real app, a signed-in person never sees the marketing page: they go straight to their dashboard.
  const { isSignedIn } = await getCurrentIdentity();
  if (isSignedIn) redirect("/dashboard");
  return (
    <>
      <Hero />
      <EstimateTeaser />
      <HowItWorks />
      <FeatureGrid />
      <ComparisonSection />
      <ClosingBand />
    </>
  );
}
