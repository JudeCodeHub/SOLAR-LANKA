import { en, type Messages } from "./en.ts";

export type { Messages } from "./en.ts";
export { format, plural } from "./format.ts";

/**
 * The messages in use. English only for the first release; adding a language means writing a
 * file with the same shape as en.ts and choosing it here from the visitor's locale.
 */
export const messages: Messages = en;
