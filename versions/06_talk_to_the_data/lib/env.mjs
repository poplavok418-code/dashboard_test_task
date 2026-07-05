import { existsSync, readFileSync } from "node:fs";

export function loadEnv(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  const text = readFileSync(envPath, "utf8");
  const keysFromOuterEnv = new Set(Object.keys(process.env));

  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key && !keysFromOuterEnv.has(key)) {
      process.env[key] = value;
    }
  }
}
