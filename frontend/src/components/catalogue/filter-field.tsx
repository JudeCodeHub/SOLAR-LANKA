import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * One filter input for a plain GET form. The field value comes from the address, and an invalid
 * value stays visible next to its message so the visitor can correct it. The label, the error and
 * aria-invalid are wired the same way as in the form components.
 */
export function FilterField({
  name,
  label,
  value,
  error,
  type = "text",
  inputMode,
  placeholder,
}: {
  name: string;
  label: string;
  value: string;
  error?: string;
  type?: "text" | "search";
  inputMode?: "decimal" | "text";
  placeholder?: string;
}) {
  const id = `filter-${name}`;
  const errorId = `${id}-error`;
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={name}
        type={type}
        defaultValue={value}
        inputMode={inputMode}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <FieldError id={errorId} role={undefined}>
          {error}
        </FieldError>
      ) : null}
    </Field>
  );
}

