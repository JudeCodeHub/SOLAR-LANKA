"use client";

import { create } from "zustand";

import type { Requirements } from "./requirements";

interface DraftState {
  /** The confirmed requirements, or null. Held in memory only: never written to browser storage. */
  draft: Requirements | null;
  setDraft: (draft: Requirements) => void;
  clear: () => void;
}

/**
 * The request being prepared. It holds what the customer typed, which is private, so it lives only
 * in this tab's memory (a reload starts again) and is cleared whenever the signed-in person
 * changes. The next steps (recipients, submission) read it from here.
 */
export const useRequestDraft = create<DraftState>()((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  clear: () => set({ draft: null }),
}));
