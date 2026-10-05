import { EntryPoints } from "@/components/landing/entry-points";
import { FeaturedCompanies } from "@/components/landing/featured-companies";
import { FeaturedProducts } from "@/components/landing/featured-products";
import { Hero } from "@/components/landing/hero";
import { getCurrentIdentity } from "@/lib/auth/server";
import { loadLanding } from "@/lib/landing/load";
import { messages } from "@/messages";

export default async function Home() {
  const [{ isSignedIn }, { panels, inverters, companies }] = await Promise.all([
    getCurrentIdentity(),
    loadLanding(),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-8">
      <Hero signedIn={isSignedIn} />
      <EntryPoints />
      <FeaturedProducts
        id="panels"
        title={messages.landing.products.panelsTitle}
        section={panels}
        viewAll={{ href: "/panels", noun: messages.catalogue.panels.resultsNoun }}
      />
      <FeaturedProducts
        id="inverters"
        title={messages.landing.products.invertersTitle}
        section={inverters}
        viewAll={{ href: "/inverters", noun: messages.catalogue.inverters.resultsNoun }}
      />
      <FeaturedCompanies section={companies} />
    </div>
  );
}
