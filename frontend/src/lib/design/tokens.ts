/** The colour tokens of the Premium Signal design (see ui_checklist.md section 2.1). The CSS variables must carry these same values. */
export const LIGHT = {
  paper: "#FBF8F3",
  paper2: "#F3EDE4",
  card: "#FFFFFF",
  ink: "#1A1511",
  ink2: "#4B4036",
  ink3: "#6E6256",
  line: "#E4DBCF",
  fieldBorder: "#857868",
  orange: "#FF6A1A",
  orangeHover: "#E85A0C",
  orangePressed: "#DB540C",
  orangeText: "#B33D00",
  orangeTint: "#FFE8D6",
  onOrange: "#1A1511",
  focus: "#B33D00",
  disabledText: "#7A6D60",
  disabledBg: "#EAE3D8",
  success: "#1F7A4D",
  warning: "#8A5A00",
  danger: "#C42B23",
  onDanger: "#FFFFFF",
  info: "#2457B8",
  successTint: "#E3F4EA",
  warningTint: "#FFF1D6",
  dangerTint: "#FDE6E4",
  infoTint: "#E6EEFC",
} as const;

export const DARK = {
  bg: "#0D0B09",
  surface: "#15110E",
  surface2: "#1D1814",
  text: "#F7F0E7",
  text2: "#CDBFB0",
  muted: "#A09282",
  line: "#2D251F",
  fieldBorder: "#76685B",
  orange: "#FF6A1A",
  orangeHover: "#FF7D38",
  orangePressed: "#E55A18",
  orangeText: "#FF8A4C",
  orangeTint: "#2B1A10",
  onOrange: "#0D0B09",
  focus: "#FF8A4C",
  disabledText: "#948779",
  disabledBg: "#1D1814",
  success: "#5FD39A",
  warning: "#F0B440",
  danger: "#FF8077",
  onDanger: "#0D0B09",
  info: "#7FA8FF",
  successTint: "#12261C",
  warningTint: "#2B2108",
  dangerTint: "#2E1512",
  infoTint: "#131D33",
} as const;

export type Theme = "light" | "dark";

/** Normal text needs 4.5 to 1; large text, essential graphics and control borders need 3 to 1. */
export const TEXT = 4.5;
export const GRAPHIC = 3;

export interface ContrastRule {
  theme: Theme;
  foreground: string;
  background: string;
  minimum: number;
  use: string;
}

function rules(theme: Theme, foregrounds: string[], backgrounds: string[], minimum: number, use: string): ContrastRule[] {
  return foregrounds.flatMap((foreground) => backgrounds.map((background) => ({ theme, foreground, background, minimum, use })));
}

const LIGHT_SURFACES = ["paper", "paper2", "card"];
const DARK_SURFACES = ["bg", "surface", "surface2"];
const LIGHT_STATUS = ["success", "warning", "danger", "info"];
const STATUS_ON_TINT: [string, string][] = [["success", "successTint"], ["warning", "warningTint"], ["danger", "dangerTint"], ["info", "infoTint"]];

function pairs(theme: Theme, list: [string, string][], minimum: number, use: string): ContrastRule[] {
  return list.map(([foreground, background]) => ({ theme, foreground, background, minimum, use }));
}

export const CONTRAST_RULES: ContrastRule[] = [
  ...rules("light", ["ink", "ink2", "ink3"], LIGHT_SURFACES, TEXT, "body and muted text"),
  ...rules("light", ["orangeText"], [...LIGHT_SURFACES, "orangeTint"], TEXT, "links and small orange text"),
  ...rules("light", ["onOrange"], ["orange", "orangeHover", "orangePressed"], TEXT, "label on an orange button"),
  ...rules("light", LIGHT_STATUS, LIGHT_SURFACES, TEXT, "status text"),
  ...pairs("light", STATUS_ON_TINT, TEXT, "status text on its tint"),
  ...pairs("light", [["onDanger", "danger"]], TEXT, "label on a danger button"),
  ...pairs("light", [["disabledText", "disabledBg"]], GRAPHIC, "disabled label"),
  ...rules("light", ["fieldBorder"], LIGHT_SURFACES, GRAPHIC, "control borders"),
  ...rules("light", ["orangeText"], LIGHT_SURFACES, GRAPHIC, "dial arc and other essential orange graphics"),
  ...rules("light", ["focus"], LIGHT_SURFACES, GRAPHIC, "focus ring"),
  ...rules("dark", ["text", "text2", "muted"], DARK_SURFACES, TEXT, "body and muted text"),
  ...rules("dark", ["orangeText"], [...DARK_SURFACES, "orangeTint"], TEXT, "links and small orange text"),
  ...rules("dark", ["onOrange"], ["orange", "orangeHover", "orangePressed"], TEXT, "label on an orange button"),
  ...rules("dark", LIGHT_STATUS, DARK_SURFACES, TEXT, "status text"),
  ...pairs("dark", STATUS_ON_TINT, TEXT, "status text on its tint"),
  ...pairs("dark", [["onDanger", "danger"]], TEXT, "label on a danger button"),
  ...pairs("dark", [["disabledText", "disabledBg"]], GRAPHIC, "disabled label"),
  ...rules("dark", ["fieldBorder"], DARK_SURFACES, GRAPHIC, "control borders"),
  ...rules("dark", ["orange"], DARK_SURFACES, GRAPHIC, "dial arc and other essential orange graphics"),
  ...rules("dark", ["focus"], DARK_SURFACES, GRAPHIC, "focus ring"),
];

/** The orange fill is only 2.7 to 1 on light surfaces, so there it may be decoration but never carry meaning. */
export const DECORATIVE_ONLY_ON_LIGHT = ["orange"];

/** The CSS custom property (--ds-<name>) that carries each token in each theme; both themes use the same property names. */
export const CSS_NAMES: Record<Theme, Record<string, string>> = {
  light: { paper: "bg", paper2: "surface-2", card: "surface", ink: "text", ink2: "text-2", ink3: "muted", line: "line", fieldBorder: "field-border", orange: "orange", orangeHover: "orange-hover", orangeText: "orange-text", orangeTint: "orange-tint", onOrange: "on-orange", focus: "focus", success: "success", warning: "warning", danger: "danger", info: "info", orangePressed: "orange-pressed", disabledText: "disabled-text", disabledBg: "disabled-bg", successTint: "success-tint", warningTint: "warning-tint", dangerTint: "danger-tint", infoTint: "info-tint", onDanger: "on-danger" },
  dark: { bg: "bg", surface: "surface", surface2: "surface-2", text: "text", text2: "text-2", muted: "muted", line: "line", fieldBorder: "field-border", orange: "orange", orangeHover: "orange-hover", orangeText: "orange-text", orangeTint: "orange-tint", onOrange: "on-orange", focus: "focus", success: "success", warning: "warning", danger: "danger", info: "info", orangePressed: "orange-pressed", disabledText: "disabled-text", disabledBg: "disabled-bg", successTint: "success-tint", warningTint: "warning-tint", dangerTint: "danger-tint", infoTint: "info-tint", onDanger: "on-danger" },
};

/** What each button variant is made of (pairs use the shared CSS names), so every variant's contrast is checked and the component cannot drift from it. */
export const BUTTON_VARIANTS: { variant: string; classes: string[]; pairs: [string, string][] }[] = [
  { variant: "default", classes: ["bg-orange", "text-on-orange"], pairs: [["on-orange", "orange"], ["on-orange", "orange-hover"], ["on-orange", "orange-pressed"]] },
  { variant: "secondary", classes: ["bg-paper-2", "text-ink"], pairs: [["text", "surface-2"]] },
  { variant: "outline", classes: ["border-field-border", "text-ink"], pairs: [["text", "bg"], ["text", "surface-2"], ["field-border", "bg"]] },
  { variant: "ghost", classes: ["text-ink", "hover:bg-paper-2"], pairs: [["text", "bg"], ["text", "surface-2"]] },
  { variant: "destructive", classes: ["bg-danger", "text-on-danger"], pairs: [["on-danger", "danger"]] },
  { variant: "link", classes: ["text-orange-text"], pairs: [["orange-text", "bg"], ["orange-text", "surface"]] },
];
