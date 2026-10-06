import { CatalogueShowcase } from "@/components/landing/catalogue-showcase";
import { CompaniesShowcase } from "@/components/landing/companies-showcase";
import { ClosingBand } from "@/components/landing/closing-band";
import { ComparisonSection } from "@/components/landing/comparison-section";
import { EstimateTeaser } from "@/components/landing/estimate-teaser";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { getCurrentIdentity } from "@/lib/auth/server";
import { LearningTeaser } from "@/components/landing/learning-teaser";
import { TrackingSection } from "@/components/landing/tracking-section";
import { SafetySection } from "@/components/landing/safety-section";
import { loadLanding } from "@/lib/landing/load";

export default async function Home() {
  const [{ isSignedIn }, { panels, inverters, companies, articles }] = await Promise.all([
    getCurrentIdentity(),
    loadLanding(),
  ]);
  return (
    <>
      <Hero signedIn={isSignedIn} />
      <EstimateTeaser />
      <HowItWorks />
      <FeatureGrid />
      <CatalogueShowcase panels={panels} inverters={inverters} />
      <CompaniesShowcase section={companies} />
      <LearningTeaser section={articles} />
      <TrackingSection />
      <ComparisonSection />
      <SafetySection />
      <ClosingBand />
    </>
  );
}
