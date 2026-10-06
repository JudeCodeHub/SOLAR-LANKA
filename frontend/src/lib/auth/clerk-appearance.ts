/** How Clerk's sign-in, sign-up and account widgets look: they borrow the site's own colour variables, so they follow the theme as it changes. */
export const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: "var(--ds-orange)",
    colorPrimaryForeground: "var(--ds-on-orange)",
    colorForeground: "var(--ds-text)",
    colorMutedForeground: "var(--ds-text-2)",
    colorBackground: "var(--ds-surface)",
    colorInput: "var(--ds-surface)",
    colorInputForeground: "var(--ds-text)",
    colorBorder: "var(--ds-field-border)",
    colorNeutral: "var(--ds-text)",
    colorDanger: "var(--ds-danger)",
    colorSuccess: "var(--ds-success)",
    colorWarning: "var(--ds-warning)",
    colorRing: "var(--ds-focus)",
    fontFamily: "var(--font-body), system-ui, sans-serif",
    fontFamilyButtons: "var(--font-body), system-ui, sans-serif",
    borderRadius: "0.5rem",
  },
  // The trailing "!" makes each class win over Clerk's own stylesheet.
  elements: {
    card: "border! border-line! shadow-e2!",
    headerTitle: "font-heading! font-semibold!",
    formButtonPrimary: "rounded-full! font-semibold! shadow-e1!",
    socialButtonsBlockButton: "rounded-field! border-field-border!",
    formFieldInput: "rounded-field!",
    // Links use the darker orange for text, since the bright orange is too pale for words on white.
    footerActionLink: "font-semibold! text-orange-text!",
    formFieldAction: "font-semibold! text-orange-text!",
    identityPreviewEditButton: "text-orange-text!",
    formResendCodeLink: "text-orange-text!",
  },
} as const;
