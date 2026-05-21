import { ApiClientError } from "@quotientjs/core";
import pc from "picocolors";
import { SCOPE_DESCRIPTIONS, type Scope } from "./scopes.js";

export const ExitCode = {
  Ok: 0,
  Generic: 1,
  Usage: 2,
  Auth: 3,
  NotFound: 4,
  Network: 5,
  Scope: 6,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

export type CLIErrorOpts = {
  code?: string;
  exitCode?: ExitCodeValue;
  details?: Record<string, unknown>;
  hint?: string;
};

export class CLIError extends Error {
  code: string;
  exitCode: ExitCodeValue;
  details?: Record<string, unknown>;
  hint?: string;

  constructor(message: string, opts: CLIErrorOpts = {}) {
    super(message);
    this.code = opts.code ?? "CLI_ERROR";
    this.exitCode = opts.exitCode ?? ExitCode.Generic;
    this.details = opts.details;
    this.hint = opts.hint;
  }
}

export class ScopeError extends CLIError {
  required: Scope[];
  granted: string[];

  constructor(required: Scope[], granted: string[]) {
    const message = `Permission denied: missing ${required.join(", ")}`;
    super(message, { code: "SCOPE_MISMATCH", exitCode: ExitCode.Scope });
    this.required = required;
    this.granted = granted;
  }
}

type NormalizedError = {
  code: string;
  message: string;
  status?: number;
  exitCode: ExitCodeValue;
  hint?: string;
  details?: Record<string, unknown>;
  required?: string[];
  granted?: string[];
};

function normalize(err: unknown): NormalizedError {
  if (err instanceof ScopeError) {
    return {
      code: err.code,
      message: err.message,
      exitCode: err.exitCode,
      required: err.required,
      granted: err.granted,
      hint: scopeHint(err.required, err.granted),
    };
  }
  if (err instanceof CLIError) {
    return {
      code: err.code,
      message: err.message,
      exitCode: err.exitCode,
      hint: err.hint,
      details: err.details,
    };
  }
  if (ApiClientError.is(err, "ApiError")) {
    const status = err.status;
    const data = err.data as {
      code?: string;
      requiredScopes?: string[];
      scopes?: string[];
    } & Record<string, unknown>;
    if (status === 401) {
      return {
        code: "UNAUTHORIZED",
        message: "Invalid or revoked API key.",
        status,
        exitCode: ExitCode.Auth,
        hint: "Run `qt auth login` with a valid private key, or check $QUOTIENT_API_KEY.",
        details: data,
      };
    }
    if (status === 403) {
      const required = (data?.requiredScopes ?? []) as string[];
      const granted = (data?.scopes ?? []) as string[];
      return {
        code: "SCOPE_MISMATCH",
        message:
          required.length > 0
            ? `Permission denied: missing ${required.join(", ")}`
            : (err.message ?? "Permission denied."),
        status,
        exitCode: ExitCode.Scope,
        required,
        granted,
        hint: scopeHint(required as Scope[], granted),
        details: data,
      };
    }
    if (status === 404) {
      return {
        code: "NOT_FOUND",
        message: err.message ?? "Resource not found.",
        status,
        exitCode: ExitCode.NotFound,
        details: data,
      };
    }
    return {
      code: "API_ERROR",
      message: err.message ?? `Quotient API error (HTTP ${status}).`,
      status,
      exitCode: ExitCode.Network,
      details: data,
    };
  }
  if (ApiClientError.is(err, "InvalidApiKey") || ApiClientError.is(err, "InvalidApiKeyType")) {
    return {
      code: "INVALID_KEY",
      message: "The configured API key is invalid for this SDK.",
      exitCode: ExitCode.Auth,
      hint: "Make sure the key starts with `sk_` and is currently active in your Quotient dashboard.",
    };
  }
  if (err instanceof Error) {
    return {
      code: "UNEXPECTED",
      message: err.message,
      exitCode: ExitCode.Generic,
    };
  }
  return {
    code: "UNEXPECTED",
    message: String(err),
    exitCode: ExitCode.Generic,
  };
}

function scopeHint(
  required: readonly Scope[] | readonly string[],
  granted: readonly string[],
): string {
  const missing = required.filter((s) => !granted.includes(s));
  if (missing.length === 0) {
    return "Generate a new private key with the needed scopes at https://app.getquotient.ai/settings/developers";
  }
  const desc = missing
    .map(
      (s) => `${s}${SCOPE_DESCRIPTIONS[s as Scope] ? ` (${SCOPE_DESCRIPTIONS[s as Scope]})` : ""}`,
    )
    .join(", ");
  return `Add scope${missing.length === 1 ? "" : "s"} to your key: ${desc}. Manage at https://app.getquotient.ai/settings/developers`;
}

export function handleError(err: unknown): never {
  const n = normalize(err);
  const isTTY = process.stderr.isTTY ?? false;

  if (!isTTY) {
    const payload: Record<string, unknown> = {
      error: {
        code: n.code,
        message: n.message,
      },
    };
    if (n.status !== undefined) (payload.error as Record<string, unknown>).status = n.status;
    if (n.required) (payload.error as Record<string, unknown>).required = n.required;
    if (n.granted) (payload.error as Record<string, unknown>).granted = n.granted;
    if (n.hint) (payload.error as Record<string, unknown>).hint = n.hint;
    if (n.details) (payload.error as Record<string, unknown>).details = n.details;
    process.stderr.write(`${JSON.stringify(payload)}\n`);
    process.exit(n.exitCode);
  }

  if (n.code === "SCOPE_MISMATCH") {
    const required = n.required ?? [];
    const granted = n.granted ?? [];
    process.stderr.write(`${pc.red("✗")} ${pc.bold("Permission denied")}\n`);
    if (required.length > 0) {
      process.stderr.write(`  This command requires ${pc.yellow(required.join(", "))}.\n`);
    }
    process.stderr.write(
      `  Your key has: ${granted.length > 0 ? pc.dim(granted.join(", ")) : pc.dim("(none reported)")}\n`,
    );
    if (n.hint) process.stderr.write(`  ${pc.cyan("Fix:")} ${n.hint}\n`);
    process.exit(n.exitCode);
  }

  process.stderr.write(`${pc.red("✗")} ${n.message}\n`);
  if (n.hint) process.stderr.write(`  ${pc.cyan("Hint:")} ${n.hint}\n`);
  process.exit(n.exitCode);
}
