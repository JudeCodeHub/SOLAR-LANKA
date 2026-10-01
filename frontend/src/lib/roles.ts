/** Display names for application roles. The backend decides roles; this only labels them. */
export const ROLE_LABELS: Record<string, string> = {
  customer: "Customer",
  platform_admin: "Platform administrator",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
