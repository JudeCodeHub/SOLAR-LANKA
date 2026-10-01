"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { CatalogueKind } from "../catalogue/params";
import { EMPTY_SELECTION, sanitizeSelection, type Selection, toggleSelection, type ToggleOutcome } from "./selection";

interface ComparisonState {
  /** Product ids only. Names and specifications are read from the server, never copied here. */
  selection: Selection;
  /** True once the saved selection has been read; before that the UI must not show selections. */
  hydrated: boolean;
  toggle: (kind: CatalogueKind, id: string) => ToggleOutcome;
  remove: (kind: CatalogueKind, id: string) => void;
  clear: (kind: CatalogueKind) => void;
  markHydrated: () => void;
}

/**
 * The comparison selection shared by every product card, product page and the tray.
 *
 * It is kept for the length of the browser tab so it survives reloads and the filter form, which
 * is an ordinary page load. It stores the ids only and every value read back is validated, so
 * nothing here can go stale or be used to smuggle data in. Loading is deferred (`skipHydration`)
 * so the first client render matches the server's; the tray triggers it once mounted.
 */
export const useComparison = create<ComparisonState>()(
  persist(
    (set, get) => ({
      selection: EMPTY_SELECTION,
      hydrated: false,
      toggle: (kind, id) => {
        const result = toggleSelection(get().selection[kind], id);
        if (result.outcome !== "full") {
          set((state) => ({ selection: { ...state.selection, [kind]: result.ids } }));
        }
        return result.outcome;
      },
      remove: (kind, id) =>
        set((state) => ({
          selection: { ...state.selection, [kind]: state.selection[kind].filter((existing) => existing !== id) },
        })),
      clear: (kind) => set((state) => ({ selection: { ...state.selection, [kind]: [] } })),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "solarlanka-comparison",
      version: 1,
      // eslint-disable-next-line no-restricted-globals -- product ids only, never credentials or tokens
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ selection: state.selection }),
      merge: (persisted, current) => ({
        ...current,
        selection: sanitizeSelection((persisted as { selection?: unknown } | undefined)?.selection),
      }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => state?.markHydrated(),
    },
  ),
);
