import { CatalogueShowcase } from "@/components/landing/catalogue-showcase";
import { CompaniesShowcase } from "@/components/landing/companies-showcase";
import { EntryPoints } from "@/components/landing/entry-points";
import { EstimateTeaser } from "@/components/landing/estimate-teaser";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { getCurrentIdentity } from "@/lib/auth/server";
import { LearningTeaser } from "@/components/landing/learning-teaser";
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
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-8">
        <EntryPoints />
      </div>
    </>
  );
}
