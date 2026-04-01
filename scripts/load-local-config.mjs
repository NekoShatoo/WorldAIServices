import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEV_VARS_PATH = resolve(process.cwd(), ".dev.vars");
const WRANGLER_PATH = resolve(process.cwd(), "wrangler.toml");

export async function getConfigValue(name, fallback = "") {
  if (process.env[name] && process.env[name].length > 0)
    return process.env[name];

  const devVars = await loadDevVars();
  if (Object.prototype.hasOwnProperty.call(devVars, name))
    return devVars[name];

  const wranglerVars = await loadWranglerVars();
  if (Object.prototype.hasOwnProperty.call(wranglerVars, name))
    return wranglerVars[name];

  return fallback;
}

async function loadDevVars() {
  try {
    const source = await readFile(DEV_VARS_PATH, "utf8");
    const lines = source.split(/\r?\n/);
    const result = {};

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.length === 0 || line.startsWith("#"))
        continue;

      const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!match)
        continue;

      result[match[1]] = stripWrappingQuotes(match[2].trim());
    }

    return result;
  } catch {
    return {};
  }
}

async function loadWranglerVars() {
  try {
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
  } catch {
    return {};
  }
}

function stripWrappingQuotes(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
