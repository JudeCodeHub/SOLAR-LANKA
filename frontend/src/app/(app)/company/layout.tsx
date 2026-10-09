import type { ReactNode } from "react";

import { AreaGuard } from "@/components/shell/area-guard";

/** The company area is for company accounts only; the sidebar frame comes from the shared layout above. */
export default function Layout({ children }: { children: ReactNode }) {
  return <AreaGuard allow={["company"]}>{children}</AreaGuard>;
}
