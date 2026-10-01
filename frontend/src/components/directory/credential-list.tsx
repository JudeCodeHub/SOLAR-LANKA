import type { PublicCompany } from "@/lib/directory/load";
import { format, messages } from "@/messages";

const text = messages.directory.credentials;

/** A company's declared credentials. */
export function CredentialList({ credentials }: { credentials: PublicCompany["declared_credentials"] }) {
  if (credentials.length === 0) {
    return <p className="text-sm text-muted-foreground">{text.none}</p>;
  }
  return (
    <ul className="space-y-2">
      {credentials.map((credential) => (
        <li
          key={`${credential.name}-${credential.issuer}`}
          className="rounded-md border border-dashed p-3 text-sm"
        >
          <p className="font-medium">{credential.name}</p>
          <p className="text-muted-foreground">{format(text.issuedBy, { issuer: credential.issuer })}</p>
          <p className="mt-1 inline-block rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
            {text.badge}
          </p>
        </li>
      ))}
    </ul>
  );
}
