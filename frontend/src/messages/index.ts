import { en, type Messages } from "./en.ts";

export type { Messages } from "./en.ts";
export { format, plural } from "./format.ts";

/** The messages in use. */
export const messages: Messages = en;
