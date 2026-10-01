"use client";

import { create } from "zustand";

import { MAX_RECIPIENTS, toggleRecipient, type ToggleResult } from "./recipients";
import type { Requirements } from "./requirements";

/** What the customer is told after a request was accepted. */
export interface SentRequest {
  id: string;
  /** True when the server recognised the submission as one it already had and created nothing new. */
  replayed: boolean;
  companies: { id: string; name: string; status: string }[];
}

interface DraftState {
  /** The confirmed requirements, or null. Held in memory only: never written to browser storage. */
  draft: Requirements | null;
  /** The companies chosen to receive the request, by id, in the order chosen. */
  recipients: string[];
  /** The idempotency key for the content last submitted, so a retry reuses it. */
  submission: { key: string; fingerprint: string } | null;
  sent: SentRequest | null;
  setDraft: (draft: Requirements) => void;
  toggle: (id: string) => ToggleResult["outcome"];
  removeRecipient: (id: string) => void;
  /** The key for this content: the existing one for identical content, otherwise a fresh one. */
  keyFor: (fingerprint: string) => string;
  markSent: (sent: SentRequest) => void;
  /** Start another request after one was sent. */
  reset: () => void;
  clear: () => void;
}

/** A fresh empty state each time, so no two resets ever share an array. */
const empty = (): Pick<DraftState, "draft" | "recipients" | "submission" | "sent"> => ({
  draft: null,
  recipients: [],
  submission: null,
  sent: null,
});

/**
 * The request being prepared. It holds what the customer typed and chose, which is private, so it
 * lives only in this tab's memory (a reload starts again) and is cleared whenever the signed-in
 * person changes.
 */
export const useRequestDraft = create<DraftState>()((set, get) => ({
  ...empty(),
  setDraft: (draft) =>
    set((state) => ({
      draft,
      // Companies were chosen for a district; a different district means choosing again.
      recipients: state.draft?.district === draft.district ? state.recipients : [],
      sent: null,
    })),
  toggle: (id) => {
    const result = toggleRecipient(get().recipients, id, MAX_RECIPIENTS);
    if (result.outcome !== "full") set({ recipients: result.ids });
    return result.outcome;
  },
  removeRecipient: (id) => set((state) => ({ recipients: state.recipients.filter((existing) => existing !== id) })),
  keyFor: (fingerprint) => {
    const existing = get().submission;
    if (existing && existing.fingerprint === fingerprint) return existing.key;
    const key = crypto.randomUUID();
    set({ submission: { key, fingerprint } });
    return key;
  },
  markSent: (sent) => set({ ...empty(), sent }),
  reset: () => set(empty()),
  clear: () => set(empty()),
}));
