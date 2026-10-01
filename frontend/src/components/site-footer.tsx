import { messages } from "@/messages";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted-foreground">
        <p>{messages.footer.disclaimer}</p>
      </div>
    </footer>
  );
}
