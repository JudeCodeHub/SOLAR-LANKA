import { ExternalLink } from "@/components/catalogue/detail/external-link";
import type { DocumentGroup } from "@/lib/catalogue/detail";
import { messages } from "@/messages";

const text = messages.detail.documents;

export function DocumentsSection({ groups }: { groups: DocumentGroup[] }) {
  return (
    <section aria-labelledby="documents-title" className="space-y-3">
      <h2 id="documents-title" className="font-heading text-2xl font-semibold tracking-tight">
        {text.title}
      </h2>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-no-documents>
          {text.none}
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.id} className="space-y-1">
            <h3 className="font-medium">{group.title}</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {group.links.map((link) => (
                <li key={link.href}>
                  <ExternalLink href={link.href}>{link.label}</ExternalLink>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
