import { QuotientServer } from "@quotientjs/server";
import { configPath, configPermsAreSafe, loadConfig } from "./config.js";
import { CLIError, ExitCode } from "./errors.js";

export type KeySource = "flag" | "env" | "config";

export type ClientHandle = {
  sdk: QuotientServer;
  apiKey: string;
  keySource: KeySource;
  baseUrl: string;
};

export function resolveApiKey(flag: string | undefined): { apiKey: string; source: KeySource } {
  if (flag) return { apiKey: flag, source: "flag" };
  const env = process.env.QUOTIENT_API_KEY;
  if (env) return { apiKey: env, source: "env" };

  const cfg = loadConfig();
  if (!cfg) {
    throw new CLIError(
      "No API key configured. Run `qt auth login`, set $QUOTIENT_API_KEY, or pass --api-key.",
      { code: "NO_API_KEY", exitCode: ExitCode.Auth },
    );
  }
  const perms = configPermsAreSafe();
  if (!perms.ok) {
    process.stderr.write(
      `warning: ${configPath()} has permissive mode ${perms.mode?.toString(8)} — should be 600.\n`,
    );
  }
  return { apiKey: cfg.apiKey, source: "config" };
}

export function assertPrivateKey(apiKey: string): void {
  if (!apiKey.startsWith("sk_")) {
    throw new CLIError(
      "This CLI only accepts private keys (sk_*). Public keys are origin-restricted browser keys.",
      { code: "PUBLIC_KEY_REJECTED", exitCode: ExitCode.Auth },
    );
  }
}

export function loadClient(opts: { apiKey?: string } = {}): ClientHandle {
  const { apiKey, source } = resolveApiKey(opts.apiKey);
  assertPrivateKey(apiKey);
  const baseUrl = process.env.QUOTIENT_BASE_URL ?? "https://www.getquotient.ai";
  const sdk = new QuotientServer({ privateKey: apiKey, baseUrl });
  return { sdk, apiKey, keySource: source, baseUrl };
}
