import { type Command, Option } from "commander";
import type { OutputFormat } from "./output.js";

export type GlobalOpts = {
  apiKey?: string;
  output?: OutputFormat;
  debug?: boolean;
  noColor?: boolean;
};

export function attachGlobalFlags(cmd: Command): Command {
  return cmd
    .addOption(
      new Option(
        "-o, --output <format>",
        "output format (auto-detects from TTY by default)",
      ).choices(["table", "json", "jsonl", "yaml"]),
    )
    .option("--api-key <key>", "Quotient private key (overrides env + config)")
    .option("--debug", "print debug trace to stderr")
    .option("--no-color", "disable ANSI color output");
}

export function getGlobalOpts(cmd: Command): GlobalOpts {
  const merged: Record<string, unknown> = {};
  let current: Command | null = cmd;
  while (current) {
    Object.assign(merged, current.opts());
    current = current.parent;
  }
  return merged as GlobalOpts;
}

export function parseKeyValueList(
  values: string[] | undefined,
): Record<string, string> | undefined {
  if (!values || values.length === 0) return undefined;
  const out: Record<string, string> = {};
  for (const raw of values) {
    const eq = raw.indexOf("=");
    if (eq === -1) {
      throw new Error(`property "${raw}" must be in key=value form`);
    }
    const k = raw.slice(0, eq);
    const v = raw.slice(eq + 1);
    out[k] = v;
  }
  return out;
}

export function collect(value: string, prev: string[] | undefined): string[] {
  return [...(prev ?? []), value];
}
