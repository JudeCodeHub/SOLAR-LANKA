"use client";

import { Segmented, segmentedItemClass } from "@/components/ui/segmented";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import { applyTheme, CHOICES, readChoice, resolveTheme, saveChoice, type ThemeChoice } from "@/lib/theme/theme";
import { messages } from "@/messages";

const text = messages.theme;
const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;
const CHANGED = "solarlanka-theme-changed";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Light, dark or follow the device; the choice is remembered in this browser. */
export function ThemeToggle() {
  const choice = useSyncExternalStore<ThemeChoice>(subscribe, readChoice, () => "system");

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => applyTheme(resolveTheme(choice, query.matches));
    apply();
    if (choice !== "system") return undefined;
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [choice]);

  const choose = (next: ThemeChoice) => {
    saveChoice(next);
    window.dispatchEvent(new Event(CHANGED));
  };

  return (
    <Segmented label={text.label} className="flex-nowrap gap-0.5 p-0.5" data-theme-toggle>
      {CHOICES.map((option) => {
        const Icon = ICONS[option];
        const active = choice === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            aria-label={text[option]}
            title={text[option]}
            onClick={() => choose(option)}
            className={segmentedItemClass(active, "size-8 min-h-0 min-w-0 px-0 pointer-coarse:size-11")}
          >
            <Icon aria-hidden className="size-4" />
          </button>
        );
      })}
    </Segmented>
  );
}
