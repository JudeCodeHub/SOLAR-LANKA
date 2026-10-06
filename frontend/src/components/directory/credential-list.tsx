import { BadgeHelp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { PublicCompany } from "@/lib/directory/load";
import { format, messages } from "@/messages";

const text = messages.directory.credentials;

/** A company's declared credentials. */
export function CredentialList({ credentials }: { credentials: PublicCompany["declared_credentials"] }) {
  if (credentials.length === 0) {
    return <p className="type-small text-ink-2">{text.none}</p>;
  }
  return (
    <ul className="space-y-2">
      {credentials.map((credential) => (
        <li
          key={`${credential.name}-${credential.issuer}`}
          className="rounded-field border border-dashed border-field-border bg-paper-2 p-3 text-sm"
        >
          <p className="font-medium text-ink">{credential.name}</p>
          <p className="text-ink-2">{format(text.issuedBy, { issuer: credential.issuer })}</p>
          <Badge variant="warning" icon={BadgeHelp} className="mt-2">
            {text.badge}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
