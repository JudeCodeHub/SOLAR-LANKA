import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { SIDEBAR } from "@/lib/navigation";
import { format, messages } from "@/messages";

const text = messages.footer;

const LINK = "inline-flex min-h-11 items-center text-base text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline motion-reduce:transition-none";

/** The links of one navigation id each, taken from the shared navigation list so the footer never names a page that does not exist. */
function linksFor(ids: readonly string[]) {
  return ids.flatMap((id) => SIDEBAR.flatMap((category) => category.items).filter((item) => item.id === id).map((item) => ({ href: item.href, label: item.label })));
}

/** The footer: a rounded panel with the brand, three link columns, a copyright line and the brand name as a huge outlined wordmark fading out at the bottom. It follows the theme: a warm cream panel in light, the night panel in dark. */
export function SiteFooter() {
  const columns = [
    { id: "product", title: text.product, links: linksFor(["panels", "inverters", "estimator", "companies"]) },
    { id: "resources", title: text.resources, links: linksFor(["learn", "troubleshooting", "safety-help"]) },
    {
      id: "account",
      title: text.account,
      links: [{ href: "/sign-in", label: messages.auth.signIn }, { href: "/sign-up", label: messages.auth.createAccount }],
    },
  ];
  return (
    <footer data-print-hide data-site-footer>
      <div className="relative isolate w-full overflow-hidden rounded-t-3xl border-t border-line bg-paper-2 text-ink">
        <div className="mx-auto grid w-full max-w-landing gap-12 px-4 pt-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,12rem))] lg:gap-14 lg:pt-16">
          <div className="space-y-6">
            <Link href="/" className="inline-flex min-h-11 items-center text-ink" aria-label={messages.app.name}>
              <Logo height={30} />
            </Link>
            <p className="footer-lede max-w-sm">{text.about}</p>
          </div>
          {columns.map((column) => (
            <nav key={column.id} aria-labelledby={`footer-${column.id}`} className="border-t border-line pt-6" data-footer-column={column.id}>
              <h2 id={`footer-${column.id}`} className="type-subheading text-ink">
                {column.title}
              </h2>
              <ul className="mt-3 space-y-0.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={LINK}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p aria-hidden data-footer-wordmark className="footer-wordmark mt-10 select-none lg:mt-6">
          {messages.app.name}
        </p>
        <div className="border-t border-line">
          <div className="mx-auto flex w-full max-w-landing flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 text-sm text-ink-3 sm:px-6">
            <p>{format(text.copyright, { year: new Date().getFullYear(), name: messages.app.name })}</p>
            <p>{messages.brand.tagline}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
