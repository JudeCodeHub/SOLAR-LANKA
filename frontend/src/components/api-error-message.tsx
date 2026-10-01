"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { type ApiError, describeError } from "@/lib/api/errors";
import { signInHref } from "@/lib/redirect";
import { messages } from "@/messages";

/** Readable name for the field an issue points at, e.g. ["body", "district"] -> "district". */
function fieldName(location: readonly (string | number)[] | undefined): string | null {
  const last = location?.at(-1);
  return typeof last === "string" ? last.replaceAll("_", " ") : null;
}

/**
 * The one way every screen shows an API failure: a titled alert in consistent wording, field
 * problems listed when there are any, a sign-in link when the session ended, and a retry
 * button only when trying again could help.
 */
export function ApiErrorMessage({
  error,
  onRetry,
  retrying = false,
  className,
}: {
  error: ApiError;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const description = describeError(error);
  const pathname = usePathname();
  return (
    <Alert variant="destructive" className={className}>
      <TriangleAlert aria-hidden />
      <AlertTitle>{description.title}</AlertTitle>
      <AlertDescription>
        <p>{description.message}</p>
        {error.issues.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {error.issues.map((issue, index) => {
              const field = fieldName(issue.location);
              return (
                <li key={`${index}-${issue.code}`}>
                  {field ? <span className="font-medium capitalize">{field}: </span> : null}
                  {issue.message}
                </li>
              );
            })}
          </ul>
        )}
        {description.kind === "signed-out" && (
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href={signInHref(pathname)}>{messages.auth.signIn}</Link>
          </Button>
        )}
        {description.retryable && onRetry && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={onRetry}
            disabled={retrying}
          >
            {retrying ? messages.states.retrying : messages.states.retry}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
