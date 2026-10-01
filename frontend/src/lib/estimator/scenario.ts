/** The one situation the estimator calculates today. */
export const SCHEMES = ["net_metering", "net_accounting", "net_plus", "net_plus_plus"] as const;
export const SYSTEM_TYPES = ["on_grid", "off_grid", "hybrid"] as const;
export const BACKUP_CHOICES = ["no", "yes"] as const;

export type Scheme = (typeof SCHEMES)[number];
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
  if (choice.connection_scheme !== DEFAULT_SCENARIO.connection_scheme) problems.push("scheme");
  if (choice.system_type !== DEFAULT_SCENARIO.system_type) problems.push("systemType");
  if (choice.backup !== DEFAULT_SCENARIO.backup) problems.push("backup");
  return problems;
}
