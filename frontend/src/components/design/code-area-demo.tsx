"use client";

import { useState } from "react";

import { CodeArea } from "@/components/admin/config-editor";
import { Button } from "@/components/ui/button";
import { parseDraft } from "@/lib/admin/config";
import { messages } from "@/messages";

/** The two JSON code areas with the real check (`parseDraft`) behind a button, and a read-only copy, for the design page; nothing is saved. */
export function CodeAreaDemo() {
  const [assumptions, setAssumptions] = useState("{oops");
  const [sources, setSources] = useState('{ "yield": { "url": "example.org" } }');
  const [errors, setErrors] = useState<Partial<Record<"assumptions" | "sources", string>>>({});
  return (
    <div className="space-y-4" data-code-sample>
      <CodeArea id="d-assumptions" name="assumptions" value={assumptions} onChange={setAssumptions} readOnly={false} error={errors.assumptions} label="Assumptions" help="The numbers the estimator uses, as one JSON object." />
      <CodeArea id="d-sources" name="sources" value={sources} onChange={setSources} readOnly={false} error={errors.sources} label="Sources" help="Where each number comes from." />
      <Button type="button" onClick={() => { const parsed = parseDraft(assumptions, sources); setErrors(parsed.ok ? {} : parsed.errors); }} data-check>
        {messages.adminEstimator.save}
      </Button>
      <CodeArea id="d-readonly" name="readonly" value={'{\n  "export_rate_lkr_per_kwh": "20.00"\n}'} onChange={() => undefined} readOnly label="A published version" help="A published version cannot be edited." />
    </div>
  );
}
