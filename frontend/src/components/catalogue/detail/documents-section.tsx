import { ExternalLink } from "@/components/catalogue/detail/external-link";
import type { DocumentGroup } from "@/lib/catalogue/detail";
import { messages } from "@/messages";

const text = messages.detail.documents;

export function DocumentsSection({ groups }: { groups: DocumentGroup[] }) {
  return (
    <section aria-labelledby="documents-title" className="space-y-3 rounded-card border border-line bg-surface p-5">
      <h2 id="documents-title" className="type-heading text-ink">
        {text.title}
      </h2>
      {groups.length === 0 ? (
        <p className="type-small text-ink-2" data-no-documents>
          {text.none}
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.id} className="space-y-1">
            <h3 className="type-subheading text-ink">{group.title}</h3>
            <ul className="space-y-1 pl-0 text-sm">
              {group.links.map((link) => (
                <li key={link.href} className="flex min-h-11 items-center">
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
