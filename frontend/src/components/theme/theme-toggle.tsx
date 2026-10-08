"use client";

import { Segmented, segmentedItemClass } from "@/components/ui/segmented";
import { Monitor, Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { applyTheme, CHOICES, readChoice, resolveTheme, saveChoice, type ThemeChoice } from "@/lib/theme/theme";
import { format, messages } from "@/messages";

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

/** One round button for the floating landing bar: it shows the sun or the moon for what the page is using now, and each press moves to the next choice (light, dark, follow the device). */
export function ThemeCycle() {
  const choice = useSyncExternalStore<ThemeChoice>(subscribe, readChoice, () => "system");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const next = resolveTheme(choice, query.matches);
      applyTheme(next);
      setDark(next === "dark");
    };
    apply();
    if (choice !== "system") return undefined;
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [choice]);

  const next = CHOICES[(CHOICES.indexOf(choice) + 1) % CHOICES.length] ?? "system";
  const Icon = dark ? Moon : Sun;
  const label = format(text.cycle, { choice: text[choice] });
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-theme-cycle
      onClick={() => {
        saveChoice(next);
        window.dispatchEvent(new Event(CHANGED));
      }}
      className="inline-grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink motion-reduce:transition-none"
    >
      <Icon aria-hidden className="size-[1.125rem]" />
    </button>
  );
}

/** The full three-choice switch everywhere, and the single round button on the landing page's floating bar. */
export function ThemeControl() {
  return usePathname() === "/" ? <ThemeCycle /> : <ThemeToggle />;
}
