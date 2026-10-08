"use client";

import { usePathname } from "next/navigation";

import { NavLink } from "@/components/shell/nav-link";
import { useNavigation } from "@/lib/api/use-shell-user";
import { messages } from "@/messages";

/** Desktop page navigation, shown as its own row under the header bar; the landing page leaves it out, since its floating bar and its own sections lead everywhere. */
export function PrimaryNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const items = useNavigation(signedIn)
    .filter((group) => group.id !== "account")
    .flatMap((group) => group.items);
  if (items.length <= 1 || pathname === "/") {
    return null;
  }
  return (
    <div className="hidden border-b border-line md:block">
      <nav aria-label={messages.nav.primaryLabel} className="mx-auto w-full max-w-6xl px-4 py-1.5">
        <ul className="flex flex-wrap items-center gap-1">
          {items.map((item) => (
            <li key={item.id}>
              <NavLink item={item} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** Desktop account links (Account, Notifications) for signed-in users. */
export function AccountLinks({ signedIn }: { signedIn: boolean }) {
  const items = useNavigation(signedIn).find((group) => group.id === "account")?.items ?? [];
  if (items.length === 0) {
    return null;
  }
  return (
    <nav aria-label={messages.nav.accountLabel} className="hidden md:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <NavLink item={item} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
