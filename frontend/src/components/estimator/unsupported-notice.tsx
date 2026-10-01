import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ScenarioProblem } from "@/lib/estimator/scenario";
import { format, messages } from "@/messages";

const text = messages.estimator;

/**
 * Appears as soon as an unsupported connection scheme, system type or backup is chosen, before
 * any submit, and says exactly which part is not calculated and how to get an estimate. It is a
 * polite status, so the explanation is announced without taking focus.
 */
export function UnsupportedNotice({
  problems,
  scheme,
  systemType,
}: {
  problems: ScenarioProblem[];
  scheme: string;
  systemType: string;
}) {
  if (problems.length === 0) return null;
  const schemeName = (messages.estimator.fields.schemeOptions as Record<string, string>)[scheme] ?? scheme;
  const systemName = (messages.estimator.fields.systemTypeOptions as Record<string, string>)[systemType] ?? systemType;
  const strip = (label: string) => label.replace(/ \((?:not )?supported(?: yet)?\)$/, "");
  return (
    <Alert role="status">
      <TriangleAlert aria-hidden />
      <AlertTitle>{text.unsupported.title}</AlertTitle>
      <AlertDescription>
        <p>{text.unsupported.lead}</p>
        <ul className="mt-1 list-disc pl-5">
          {problems.includes("scheme") ? (
            <li>{format(text.unsupported.scheme, { name: strip(schemeName) })}</li>
          ) : null}
          {problems.includes("systemType") ? (
            <li>{format(text.unsupported.systemType, { name: strip(systemName) })}</li>
          ) : null}
          {problems.includes("backup") ? <li>{text.unsupported.backup}</li> : null}
        </ul>
        <p className="mt-2">{text.unsupported.fix}</p>
      </AlertDescription>
    </Alert>
  );
}
