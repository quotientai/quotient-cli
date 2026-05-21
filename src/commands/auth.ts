import { password } from "@clack/prompts";
import type { WhoAmIResponse } from "@quotientjs/core";
import { Command } from "commander";
import pc from "picocolors";
import { assertPrivateKey, loadClient } from "../client.js";
import { clearConfig, configPath, loadConfig, maskKey, saveConfig } from "../config.js";
import { ExitCode, handleError } from "../errors.js";
import { attachGlobalFlags, getGlobalOpts } from "../flags.js";
import { printObject } from "../output.js";
import { SCOPE_DESCRIPTIONS, type Scope } from "../scopes.js";

type WhoAmIView = WhoAmIResponse & {
  source: "flag" | "env" | "config";
  maskedKey: string;
  configPath: string | null;
};

function fmtScopes(scopes: readonly string[] | undefined): string {
  if (!scopes || scopes.length === 0) return pc.dim("(none)");
  return [...scopes]
    .sort()
    .map((s) => {
      const desc = SCOPE_DESCRIPTIONS[s as Scope];
      return desc ? `${pc.cyan(s)} ${pc.dim(`(${desc})`)}` : pc.cyan(s);
    })
    .join("\n");
}

function fmtSource(src: "flag" | "env" | "config"): string {
  if (src === "flag") return pc.yellow("--api-key flag");
  if (src === "env") return pc.yellow("$QUOTIENT_API_KEY");
  return pc.yellow("XDG config");
}

export function authCommand(): Command {
  const cmd = new Command("auth").description("Manage your Quotient private key");

  attachGlobalFlags(
    cmd
      .command("login")
      .description("Save a private key (sk_*) — pass --api-key to skip the prompt"),
  ).action(async function (this: Command) {
    try {
      const opts = getGlobalOpts(this);
      let key = opts.apiKey;
      if (!key) {
        const r = await password({
          message: "Paste your Quotient private key (sk_...)",
          mask: "•",
          validate: (v) => {
            if (!v) return "Required";
            if (!v.startsWith("sk_")) return "Private keys start with sk_";
            return undefined;
          },
        });
        if (typeof r !== "string") {
          process.stderr.write("Cancelled.\n");
          process.exit(ExitCode.Usage);
        }
        key = r;
      }
      assertPrivateKey(key);

      const probe = loadClient({ apiKey: key });
      const me = await probe.sdk.auth.whoami({});
      const saved = saveConfig(key);

      if (process.stdout.isTTY) {
        process.stdout.write(`${pc.green("✓")} Saved key to ${pc.bold(saved.path)} (mode 600)\n`);
        process.stdout.write(`  ${pc.bold("business:")} ${me.businessId}\n`);
        process.stdout.write(`  ${pc.bold("key type:")} ${me.keyType}\n`);
        process.stdout.write(`  ${pc.bold("scopes:  ")} ${fmtScopes(me.scopes)}\n`);
      } else {
        process.stdout.write(`${JSON.stringify({ ok: true, path: saved.path, whoami: me })}\n`);
      }
    } catch (e) {
      handleError(e);
    }
  });

  attachGlobalFlags(
    cmd.command("logout").description("Remove the local API key from XDG config"),
  ).action(async function (this: Command) {
    try {
      const removed = clearConfig();
      const path = configPath();
      if (process.stdout.isTTY) {
        process.stdout.write(
          removed
            ? `${pc.green("✓")} Removed ${pc.bold(path)}\n`
            : `${pc.dim("nothing to remove (no key was saved)")}\n`,
        );
      } else {
        process.stdout.write(`${JSON.stringify({ ok: true, removed, path })}\n`);
      }
    } catch (e) {
      handleError(e);
    }
  });

  attachGlobalFlags(
    cmd.command("whoami").description("Verify the configured key — shows business + scopes"),
  ).action(async function (this: Command) {
    try {
      const opts = getGlobalOpts(this);
      const client = loadClient({ apiKey: opts.apiKey });
      const me = await client.sdk.auth.whoami({});
      const view: WhoAmIView = {
        ...me,
        source: client.keySource,
        maskedKey: maskKey(client.apiKey),
        configPath: loadConfig() ? configPath() : null,
      };
      printObject(
        view,
        [
          { label: "Business", get: (d) => d.businessId },
          { label: "Key type", get: (d) => d.keyType },
          { label: "Scopes", get: (d) => d.scopes, format: (v) => fmtScopes(v as string[]) },
          { label: "Key", get: (d) => d.maskedKey },
          {
            label: "Source",
            get: (d) => d.source,
            format: (v) => fmtSource(v as "flag" | "env" | "config"),
          },
          { label: "Config", get: (d) => d.configPath ?? pc.dim("(env/flag only)") },
        ],
        opts,
      );
    } catch (e) {
      handleError(e);
    }
  });

  return cmd;
}
