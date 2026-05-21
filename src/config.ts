import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type Config = {
  apiKey: string;
  savedAt: string;
};

export function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
  return join(base, "quotient");
}

export function configPath(): string {
  return join(configDir(), "config.json");
}

export function loadConfig(): Config | null {
  const path = configPath();
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<Config>;
    if (typeof parsed.apiKey !== "string" || parsed.apiKey.length === 0) return null;
    return {
      apiKey: parsed.apiKey,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
    };
  } catch {
    return null;
  }
}

export function saveConfig(apiKey: string): { path: string } {
  const path = configPath();
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const body: Config = { apiKey, savedAt: new Date().toISOString() };
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  chmodSync(path, 0o600);
  return { path };
}

export function clearConfig(): boolean {
  const path = configPath();
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

export function configPermsAreSafe(): { ok: boolean; mode?: number } {
  const path = configPath();
  if (!existsSync(path)) return { ok: true };
  try {
    const s = statSync(path);
    const mode = s.mode & 0o777;
    return { ok: (mode & 0o077) === 0, mode };
  } catch {
    return { ok: true };
  }
}

export function maskKey(apiKey: string): string {
  if (apiKey.length <= 8) return "sk_****";
  const tail = apiKey.slice(-4);
  return `sk_****${tail}`;
}
