/** Fill {placeholders} in a message. A placeholder with no value is left visible, never blank. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export interface PluralForms {
  one: string;
  other: string;
}

/** Choose the wording for a count using the language's own plural rules. */
export function plural(forms: PluralForms, count: number, locale = "en"): string {
  return new Intl.PluralRules(locale).select(count) === "one" ? forms.one : forms.other;
}
