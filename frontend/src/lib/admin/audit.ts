/** How audit entries read to a platform administrator. */
import { messages } from "../../messages/index.ts";

export const AUDIT_PAGE_SIZE = 20;

export function actionLabel(action: string): string {
  return (messages.adminActivity.actions as Record<string, string>)[action] ?? action;
}
