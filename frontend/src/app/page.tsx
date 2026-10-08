import { ClosingBand } from "@/components/landing/closing-band";
import { ComparisonSection } from "@/components/landing/comparison-section";
import { EstimateTeaser } from "@/components/landing/estimate-teaser";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { getCurrentIdentity } from "@/lib/auth/server";

/** The landing page: six sections (hero, a sample estimate, how it works, what you can do, a quotation comparison and a closing call to action); it needs no data from the API, so it opens even when the backend is down. */
export default async function Home() {
  const { isSignedIn } = await getCurrentIdentity();
  return (
    <>
      <Hero signedIn={isSignedIn} />
      <EstimateTeaser />
      <HowItWorks />
      <FeatureGrid />
      <ComparisonSection />
      <ClosingBand />
    </>
  );
}
