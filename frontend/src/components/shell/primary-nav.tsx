"use client";

import { NavLink } from "@/components/shell/nav-link";
import { useNavigation } from "@/lib/api/use-shell-user";

/**
 * Desktop page navigation, shown as its own row under the header bar so it can grow to a dozen
 * links and wrap instead of overflowing. Hidden while "Home" is the only destination, since the
 * brand link already goes there.
 */
export function PrimaryNav({ signedIn }: { signedIn: boolean }) {
  const items = useNavigation(signedIn)
    .filter((group) => group.id !== "account")
    .flatMap((group) => group.items);
  if (items.length <= 1) {
    return null;
  }
  return (
    <div className="hidden border-t md:block">
      <nav aria-label="Primary" className="mx-auto w-full max-w-6xl px-4 py-1">
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
    <nav aria-label="Account" className="hidden md:block">
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
