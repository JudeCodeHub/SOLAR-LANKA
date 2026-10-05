/** The colour tokens of the Premium Signal design (see ui_checklist.md section 2.1). The CSS variables must carry these same values. */
export const LIGHT = {
  paper: "#FBF8F3",
  paper2: "#F3EDE4",
  card: "#FFFFFF",
  ink: "#1A1511",
  ink2: "#4B4036",
  ink3: "#6E6256",
  fieldBorder: "#857868",
  orange: "#FF6A1A",
  orangeHover: "#E85A0C",
  orangeText: "#B33D00",
  orangeTint: "#FFE8D6",
  onOrange: "#1A1511",
  focus: "#B33D00",
  success: "#1F7A4D",
  warning: "#8A5A00",
  danger: "#C42B23",
  info: "#2457B8",
} as const;

export const DARK = {
  bg: "#0D0B09",
  surface: "#15110E",
  surface2: "#1D1814",
  text: "#F7F0E7",
  text2: "#CDBFB0",
  muted: "#A09282",
  fieldBorder: "#76685B",
  orange: "#FF6A1A",
  orangeText: "#FF8A4C",
  onOrange: "#0D0B09",
  focus: "#FF8A4C",
  success: "#5FD39A",
  warning: "#F0B440",
  danger: "#FF8077",
  info: "#7FA8FF",
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

export const CONTRAST_RULES: ContrastRule[] = [
  ...rules("light", ["ink", "ink2", "ink3"], LIGHT_SURFACES, TEXT, "body and muted text"),
  ...rules("light", ["orangeText"], [...LIGHT_SURFACES, "orangeTint"], TEXT, "links and small orange text"),
  ...rules("light", ["onOrange"], ["orange", "orangeHover"], TEXT, "label on an orange button"),
  ...rules("light", LIGHT_STATUS, LIGHT_SURFACES, TEXT, "status text"),
  ...rules("light", ["fieldBorder"], LIGHT_SURFACES, GRAPHIC, "control borders"),
  ...rules("light", ["orangeText"], LIGHT_SURFACES, GRAPHIC, "dial arc and other essential orange graphics"),
  ...rules("light", ["focus"], LIGHT_SURFACES, GRAPHIC, "focus ring"),
  ...rules("dark", ["text", "text2", "muted"], DARK_SURFACES, TEXT, "body and muted text"),
  ...rules("dark", ["orangeText"], DARK_SURFACES, TEXT, "links and small orange text"),
  ...rules("dark", ["onOrange"], ["orange"], TEXT, "label on an orange button"),
  ...rules("dark", LIGHT_STATUS, DARK_SURFACES, TEXT, "status text"),
  ...rules("dark", ["fieldBorder"], DARK_SURFACES, GRAPHIC, "control borders"),
  ...rules("dark", ["orange"], DARK_SURFACES, GRAPHIC, "dial arc and other essential orange graphics"),
  ...rules("dark", ["focus"], DARK_SURFACES, GRAPHIC, "focus ring"),
];

/** The orange fill is only 2.7 to 1 on light surfaces, so there it may be decoration but never carry meaning. */
export const DECORATIVE_ONLY_ON_LIGHT = ["orange"];
