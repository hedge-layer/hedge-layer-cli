import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".hedgelayer");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export const DEFAULT_API_URL = "https://hedgelayer.ai";

export interface Config {
  api_url: string;
  token: string | null;
}

function defaultConfig(): Config {
  return { api_url: DEFAULT_API_URL, token: null };
}

export function loadConfig(): Config {
  try {
    if (!existsSync(CONFIG_FILE)) return defaultConfig();
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      api_url: parsed.api_url ?? DEFAULT_API_URL,
      token: parsed.token ?? null,
    };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(config: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function clearConfig(): void {
  try {
    if (existsSync(CONFIG_FILE)) unlinkSync(CONFIG_FILE);
  } catch {
    // ignore
  }
}

export function configPath(): string {
  return CONFIG_FILE;
}
