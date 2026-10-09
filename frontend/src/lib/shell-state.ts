import { useSyncExternalStore } from "react";

/**
 * The sidebar's remembered layout: whether it is collapsed to icons, and which categories the person opened or shut by hand.
 * It is kept in this browser only, as a convenience; it holds nothing about who the person is or what they may see, and the sidebar works the same way when storage is missing.
 */
const KEY = "solarlanka-sidebar";
const CHANGED = "solarlanka-sidebar-changed";

export interface SidebarState {
  collapsed: boolean;
  /** true opens a category, false shuts it, whatever the current page would do. */
  overrides: Record<string, boolean>;
}

const EMPTY: SidebarState = { collapsed: false, overrides: {} };

function read(): string {
  try {
    // eslint-disable-next-line no-restricted-properties -- a non-auth layout preference, wrapped so blocked storage only means the default layout
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function parse(raw: string): SidebarState {
  if (!raw) return EMPTY;
  try {
    const value = JSON.parse(raw) as Partial<SidebarState>;
    return { collapsed: value.collapsed === true, overrides: typeof value.overrides === "object" && value.overrides !== null ? value.overrides : {} };
  } catch {
    return EMPTY;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function saveSidebarState(next: SidebarState): void {
  try {
    // eslint-disable-next-line no-restricted-properties -- see read()
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked or full: the layout simply is not remembered.
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** The remembered layout; the default (open, nothing overridden) on the server and while storage is empty. */
export function useSidebarState(): SidebarState {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return parse(raw);
}
