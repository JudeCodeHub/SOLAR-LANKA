/** The situations the estimator calculates: three grid-connected schemes, on-grid, no backup. */
export const SCHEMES = ["net_metering", "net_accounting", "net_plus", "net_plus_plus"] as const;
export const SYSTEM_TYPES = ["on_grid", "off_grid", "hybrid"] as const;
export const BACKUP_CHOICES = ["no", "yes"] as const;

export type Scheme = (typeof SCHEMES)[number];

/** Net plus plus (a power-plant arrangement) is still not calculated. */
export const SUPPORTED_SCHEMES = ["net_metering", "net_accounting", "net_plus"] as const;
export type SupportedScheme = (typeof SUPPORTED_SCHEMES)[number];
export const isSupportedScheme = (value: string): value is SupportedScheme => (SUPPORTED_SCHEMES as readonly string[]).includes(value);
export type SystemType = (typeof SYSTEM_TYPES)[number];
export type BackupChoice = (typeof BACKUP_CHOICES)[number];

export const DEFAULT_SCENARIO = {
  connection_scheme: "net_metering",
  system_type: "on_grid",
  backup: "no",
} as const satisfies { connection_scheme: Scheme; system_type: SystemType; backup: BackupChoice };

export type ScenarioProblem = "scheme" | "systemType" | "backup";

/** Which parts of the chosen scenario are not calculated yet. Empty means supported. */
export function unsupportedParts(choice: {
  connection_scheme: string;
  system_type: string;
  backup: string;
}): ScenarioProblem[] {
  const problems: ScenarioProblem[] = [];
  if (!isSupportedScheme(choice.connection_scheme)) problems.push("scheme");
  if (choice.system_type !== DEFAULT_SCENARIO.system_type) problems.push("systemType");
  if (choice.backup !== DEFAULT_SCENARIO.backup) problems.push("backup");
  return problems;
}
