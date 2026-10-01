"use client";

import {
  createContext,
  type FormEvent,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { FieldValues, SubmitHandler, UseFormReturn } from "react-hook-form";

import { ApiErrorMessage } from "@/components/api-error-message";
import { type ApiError, ensureApiError } from "@/lib/api/errors";
import { applyApiIssues } from "@/lib/forms/apply-api-error";
import { collectFieldProblems, fieldId } from "@/lib/forms/errors";
import { messages } from "@/messages";

interface AppFormContextValue {
  formId: string;
  /** Field label text by field name, filled in by the fields, used by the error summary. */
  labels: Map<string, string>;
}

const AppFormContext = createContext<AppFormContextValue | null>(null);

export function useAppFormContext(): AppFormContextValue {
  const context = useContext(AppFormContext);
  if (context === null) {
    throw new Error("Form fields must be rendered inside <AppForm>.");
  }
  return context;
}

/** The shared form shell. */
export function AppForm<TInput extends FieldValues, TOutput extends FieldValues = TInput>({
  form,
  onSubmit,
  children,
  className,
}: {
  form: UseFormReturn<TInput, unknown, TOutput>;
  onSubmit: SubmitHandler<TOutput>;
  children: ReactNode;
  className?: string;
}) {
  const formId = useId();
  const [labels] = useState(() => new Map<string, string>());
  const [serverError, setServerError] = useState<ApiError | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const noticeRef = useRef<HTMLDivElement>(null);
  // Set when a submit fails; cleared once focus has moved.
  const focusRequested = useRef(false);
  // Synchronous guard: React state is too slow to stop two clicks in the same moment.
  const inFlight = useRef(false);
  const { errors, isSubmitting } = form.formState;
  const problems = collectFieldProblems(errors);
  const showNotice = failedAttempts > 0 && (serverError !== null || problems.length > 0);

  // The summary can appear a render after the failed attempt.
  useEffect(() => {
    if (focusRequested.current && noticeRef.current) {
      noticeRef.current.focus();
      focusRequested.current = false;
    }
  }, [failedAttempts, showNotice]);

  const noteFailure = () => {
    focusRequested.current = true;
    setFailedAttempts((count) => count + 1);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    const submit = form.handleSubmit(
      async (values) => {
        setServerError(null);
        try {
          await onSubmit(values);
        } catch (caught) {
          const error = ensureApiError(caught);
          const { mapped, unmapped } = applyApiIssues(form, error);
          unmapped.forEach((message, index) =>
            form.setError(`root.issue${index}` as never, { type: "server", message }),
          );
          if (mapped === 0 && unmapped.length === 0) {
            setServerError(error);
          }
          noteFailure();
        }
      },
      noteFailure,
    );
    void submit(event).finally(() => {
      inFlight.current = false;
    });
  };

  return (
    <AppFormContext.Provider value={{ formId, labels }}>
      <form
        noValidate
        id={formId}
        onSubmit={handleSubmit}
        aria-busy={isSubmitting}
        className={className}
      >
        {showNotice && (
          <div ref={noticeRef} tabIndex={-1} className="mb-6 outline-none">
            {serverError ? (
              <ApiErrorMessage error={serverError} />
            ) : (
              <FormErrorSummary
                problems={problems}
                formId={formId}
                labels={labels}
                onFocusField={(name) => form.setFocus(name as never)}
              />
            )}
          </div>
        )}
        {children}
      </form>
    </AppFormContext.Provider>
  );
}

function FormErrorSummary({
  problems,
  formId,
  labels,
  onFocusField,
}: {
  problems: { name: string; message: string }[];
  formId: string;
  labels: Map<string, string>;
  onFocusField: (name: string) => void;
}) {
  const titleId = useId();
  return (
    <div
      role="alert"
      aria-labelledby={titleId}
      className="rounded-lg border border-destructive p-4 text-sm text-destructive"
    >
      <h2 id={titleId} className="font-medium">
        {messages.forms.errorSummaryTitle}
      </h2>
      <p className="mt-1">{messages.forms.errorSummaryIntro}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {problems.map((problem) => {
          const label = labels.get(problem.name);
          const isGeneral = problem.name.startsWith("root.");
          return (
            <li key={problem.name}>
              {isGeneral ? (
                problem.message
              ) : (
                <a
                  href={`#${fieldId(formId, problem.name)}`}
                  className="underline underline-offset-2"
                  onClick={(event) => {
                    event.preventDefault();
                    onFocusField(problem.name);
                  }}
                >
                  {label ? `${label}: ${problem.message}` : problem.message}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
