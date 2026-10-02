import { join } from "node:path";

export const E2E_DIR = join(import.meta.dirname, "..");
export const TMP_DIR = join(E2E_DIR, ".tmp");
export const IDENTITY_FILE = join(TMP_DIR, "identity.txt");
export const FAIL_FILE = join(TMP_DIR, "fail.txt");
export const BACKEND_DIR = join(E2E_DIR, "..", "..", "backend");
export const API_PORT = 8001;
export const PROXY_PORT = 8000;
