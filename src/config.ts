import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync, unlinkSync } from "node:fs";
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
      api_url: typeof parsed.api_url === "string" ? parsed.api_url : DEFAULT_API_URL,
      token: typeof parsed.token === "string" ? parsed.token : null,
    };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(config: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", { encoding: "utf-8", mode: 0o600 });
  chmodSync(CONFIG_FILE, 0o600);
}

export function clearConfig(): void {
  try {
    if (existsSync(CONFIG_FILE)) unlinkSync(CONFIG_FILE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export function configPath(): string {
  return CONFIG_FILE;
}
