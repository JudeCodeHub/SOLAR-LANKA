/** The theme choice: light, dark, or follow the device. It is remembered in this browser and applied before the first paint. */
export const THEME_KEY = "solarlanka-theme";
export const CHOICES = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof CHOICES)[number];
export type Theme = "light" | "dark";

export function parseChoice(value: string | null | undefined): ThemeChoice {
  return (CHOICES as readonly string[]).includes(value ?? "") ? (value as ThemeChoice) : "system";
}

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): Theme {
  return choice === "system" ? (prefersDark ? "dark" : "light") : choice;
}

/** Runs in the page head before anything is painted, so a dark choice never flashes light. Keep it in step with applyTheme. */
export const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem("${THEME_KEY}");if(c!=="light"&&c!=="dark")c="system";var d=c==="dark"||(c==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.dataset.theme=d?"dark":"light";}catch(e){}})();`;

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
}

export function readChoice(): ThemeChoice {
  try {
    // eslint-disable-next-line no-restricted-globals -- a colour preference, not an auth token
    return parseChoice(localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

export function saveChoice(choice: ThemeChoice): void {
  try {
    // eslint-disable-next-line no-restricted-globals -- a colour preference, not an auth token
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Storage can be blocked; the choice then lasts for this visit only.
  }
}
