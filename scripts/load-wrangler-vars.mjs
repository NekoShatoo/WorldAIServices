import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const WRANGLER_PATH = resolve(process.cwd(), "wrangler.toml");

export async function loadWranglerVars() {
  const source = await readFile(WRANGLER_PATH, "utf8");
  const lines = source.split(/\r?\n/);
  const result = {};
  let inVars = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#"))
      continue;

    if (line.startsWith("[")) {
      inVars = line === "[vars]";
      continue;
    }

    if (!inVars)
      continue;

    const match = line.match(/^([A-Z0-9_]+)\s*=\s*"(.*)"$/);
    if (!match)
      continue;

    result[match[1]] = match[2];
  }

  return result;
}

export async function getConfigValue(name, fallback = "") {
  if (process.env[name] && process.env[name].length > 0)
    return process.env[name];

  const vars = await loadWranglerVars();
  return vars[name] ?? fallback;
}
