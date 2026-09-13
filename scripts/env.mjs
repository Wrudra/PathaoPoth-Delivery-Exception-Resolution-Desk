import fs from "node:fs";
import path from "node:path";

// Minimal dotenv reader for the dev tooling (Next.js loads these files itself
// for the app; the scripts here run before Next starts). Precedence mirrors
// Next: .env.local overrides .env, and real process env overrides both.
export function readDevEnv(cwd = process.cwd()) {
  const merged = {};
  for (const file of [".env", ".env.local"]) {
    const full = path.join(cwd, file);
    if (!fs.existsSync(full)) continue;
    for (const rawLine of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      merged[key] = value;
    }
  }
  return { ...merged, ...process.env };
}

export function devHost(env) {
  return (env.BLOCKS_DEV_HOST || "").trim();
}

export function devPort(env) {
  return Number(env.BLOCKS_DEV_PORT || 3000);
}
