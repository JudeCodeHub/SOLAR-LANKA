import { messages } from "@/messages";

/** Display names for application roles. The backend decides roles; this only labels them. */
export function roleLabel(role: string): string {
  const labels: Record<string, string> = messages.roles;
  return labels[role] ?? role;
}
