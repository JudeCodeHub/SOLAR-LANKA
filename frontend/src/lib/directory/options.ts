/**
 * The values the directory can be filtered by. They mirror the backend's allowed districts and
 * services (the generated API types fail to compile here if the backend list changes), so a
 * filter the backend would refuse can never be offered.
 */
import type { components } from "../api/schema";

type Company = components["schemas"]["PublicCompanyResponse"];
export type District = Company["service_districts"][number];
export type Service = Company["services"][number];

export const DISTRICTS = [
  "Ampara",
  "Anuradhapura",
  "Badulla",
  "Batticaloa",
  "Colombo",
  "Galle",
  "Gampaha",
  "Hambantota",
  "Jaffna",
  "Kalutara",
  "Kandy",
  "Kegalle",
  "Kilinochchi",
  "Kurunegala",
  "Mannar",
  "Matale",
  "Matara",
  "Monaragala",
  "Mullaitivu",
  "Nuwara Eliya",
  "Polonnaruwa",
  "Puttalam",
  "Ratnapura",
  "Trincomalee",
  "Vavuniya",
] as const satisfies readonly District[];

export const SERVICES = [
  "installation",
  "maintenance",
  "repair",
  "battery_installation",
  "site_assessment",
] as const satisfies readonly Service[];

// Compile-time completeness: every backend value must be listed above.
type Missing<T, L extends readonly T[]> = Exclude<T, L[number]>;
export const listsAreComplete: [Missing<District, typeof DISTRICTS>, Missing<Service, typeof SERVICES>] extends [never, never]
  ? true
  : never = true;
