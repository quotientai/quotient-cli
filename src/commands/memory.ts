import { confirm } from "@clack/prompts";
import type { MemoryFolderItem, MemoryTag, Path, SearchMemoryResult } from "@quotientjs/core";
import { Command } from "commander";
import pc from "picocolors";
import { loadClient } from "../client.js";
import { CLIError, ExitCode, handleError } from "../errors.js";
import { attachGlobalFlags, collect, getGlobalOpts } from "../flags.js";
import { printList, printObject } from "../output.js";

function asPath(input: string): Path {
  if (!input.startsWith("/")) {
    throw new CLIError(`Memory paths must start with "/" (got "${input}").`, {
      code: "BAD_PATH",
      exitCode: ExitCode.Usage,
    });
  }
  return input as Path;
}

const PLATFORM_TAGS = new Set<string>([
  "email",
  "blog",
  "social",
  "tone",
  "audience",
  "brand",
  "competitors",
  "products",
]);

function asTag(raw: string): MemoryTag {
  if (raw.startsWith("user:")) return raw as MemoryTag;
  if (PLATFORM_TAGS.has(raw)) return raw as MemoryTag;
  return `user:${raw}` satisfies MemoryTag;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function memoryCommand(): Command {
  const cmd = new Command("memory").description("Browse, read, and write Quotient memory");

  attachGlobalFlags(
    cmd
      .command("ls <path>")
      .description("List items at a memory path")
      .option("--deep", "recurse into subfolders"),
  ).action(async function (this: Command, path: string) {
    try {
      const opts = getGlobalOpts(this);
      const local = this.opts<{ deep?: boolean }>();
      const { sdk } = loadClient({ apiKey: opts.apiKey });
      const res = await sdk.memory.ls({ path: asPath(path), deep: local.deep });
      printList(
        res,
        { items: (d) => d.items },
        [
          {
            header: "Type",
            get: (i: MemoryFolderItem) => i.type,
            format: (v) => (v === "folder" ? pc.cyan("dir ") : pc.dim("doc ")),
          },
          { header: "Name", get: (i: MemoryFolderItem) => i.name },
          { header: "Path", get: (i: MemoryFolderItem) => i.path, width: 50 },
          { header: "Updated", get: (i: MemoryFolderItem) => i.updatedAt },
        ],
        { ...opts, empty: `Nothing at ${path}.` },
      );
    } catch (e) {
      handleError(e);
    }
  });

  attachGlobalFlags(cmd.command("cat <path>").description("Read a memory document")).action(
    async function (this: Command, path: string) {
      try {
        const opts = getGlobalOpts(this);
        const { sdk } = loadClient({ apiKey: opts.apiKey });
        const res = await sdk.memory.cat({ path: asPath(path) });

        const format = opts.output ?? (process.stdout.isTTY ? "table" : "json");
        if (format === "table") {
          if (process.stdout.isTTY) {
            process.stdout.write(`${pc.bold(res.name)} ${pc.dim(res.path)}\n`);
            if (res.tags.length > 0)
              process.stdout.write(`${pc.dim("tags:")} ${res.tags.join(", ")}\n`);
            if (res.pinned) process.stdout.write(`${pc.yellow("📌 pinned")}\n`);
            process.stdout.write(`\n${res.content}\n`);
          } else {
            process.stdout.write(res.content);
          }
          return;
        }
        printObject(
          res,
          [
            { label: "Name", get: (d) => d.name },
            { label: "Path", get: (d) => d.path },
            { label: "Tags", get: (d) => d.tags.join(", ") },
            { label: "Pinned", get: (d) => (d.pinned ? "yes" : "no") },
            { label: "Updated", get: (d) => d.updatedAt },
            { label: "Content", get: (d) => d.content },
          ],
          opts,
        );
      } catch (e) {
        handleError(e);
      }
    },
  );

  attachGlobalFlags(
    cmd
      .command("write <path>")
      .description("Create or update a document (--content | --file | --stdin)")
      .option("--title <title>")
      .option("--content <text>", "inline content")
      .option("--file <local-path>", "read content from a local file")
      .option("--stdin", "read content from stdin")
      .option(
        "--tag <tag>",
        "platform tag (email, blog, social, …) or any user tag — auto-prefixed with user: (repeatable)",
        collect,
      )
      .option("--pinned", "pin this document"),
  ).action(async function (this: Command, path: string) {
    try {
      const opts = getGlobalOpts(this);
      const local = this.opts<{
        title?: string;
        content?: string;
        file?: string;
        stdin?: boolean;
        tag?: string[];
        pinned?: boolean;
      }>();
      const sourceCount =
        Number(local.content !== undefined) +
        Number(local.file !== undefined) +
        Number(local.stdin === true);
      if (sourceCount > 1) {
        throw new CLIError("Pass exactly one of --content, --file, or --stdin.", {
          code: "USAGE",
          exitCode: ExitCode.Usage,
        });
      }

      let content: string | undefined = local.content;
      if (local.file) content = await Bun.file(local.file).text();
      if (local.stdin) content = await readStdin();

      const tags: MemoryTag[] | undefined = local.tag?.map(asTag);
      const { sdk } = loadClient({ apiKey: opts.apiKey });
      const res = await sdk.memory.write({
        path: asPath(path),
        title: local.title,
        content,
        tags,
        pinned: local.pinned,
      });
      printObject(
        res,
        [
          { label: "Name", get: (d) => d.name },
          { label: "Path", get: (d) => d.path },
          { label: "Tags", get: (d) => (d.tags ?? tags ?? []).join(", ") },
          { label: "Pinned", get: (d) => (d.pinned ? "yes" : "no") },
          {
            label: "Bytes",
            get: () => (content !== undefined ? Buffer.byteLength(content, "utf8") : 0),
          },
        ],
        opts,
      );
    } catch (e) {
      handleError(e);
    }
  });

  attachGlobalFlags(
    cmd.command("mkdir <path>").description("Create a folder").option("--name <name>"),
  ).action(async function (this: Command, path: string) {
    try {
      const opts = getGlobalOpts(this);
      const local = this.opts<{ name?: string }>();
      const { sdk } = loadClient({ apiKey: opts.apiKey });
      const res = await sdk.memory.mkdir({ path: asPath(path), name: local.name });
      printObject(
        res,
        [
          { label: "Name", get: (d) => d.name },
          { label: "Path", get: (d) => d.path },
          { label: "Created", get: (d) => d.createdAt },
        ],
        opts,
      );
    } catch (e) {
      handleError(e);
    }
  });

  attachGlobalFlags(
    cmd
      .command("rm <path>")
      .description("Archive a document or folder (soft-delete)")
      .option("-y, --yes", "skip the confirmation prompt"),
  ).action(async function (this: Command, path: string) {
    try {
      const opts = getGlobalOpts(this);
      const local = this.opts<{ yes?: boolean }>();
      if (!local.yes && process.stdin.isTTY) {
        const ok = await confirm({ message: `Archive ${path}?`, initialValue: false });
        if (ok !== true) {
          process.stderr.write("Cancelled.\n");
          process.exit(ExitCode.Usage);
        }
      }
      const { sdk } = loadClient({ apiKey: opts.apiKey });
      const res = await sdk.memory.rm({ path: asPath(path) });
      printObject(
        { ...res, path },
        [
          {
            label: "Status",
            get: (d) => (d.success ? pc.green("✓ archived") : pc.red("✗ failed")),
          },
          { label: "Path", get: (d) => d.path },
        ],
        opts,
      );
    } catch (e) {
      handleError(e);
    }
  });

  attachGlobalFlags(
    cmd
      .command("search <query>")
      .description("Semantic search across memory chunks")
      .option(
        "--tag <tag>",
        "filter by tag (auto-prefixed user: if not a platform tag, repeatable)",
        collect,
      ),
  ).action(async function (this: Command, query: string) {
    try {
      const opts = getGlobalOpts(this);
      const local = this.opts<{ tag?: string[] }>();
      const tags: MemoryTag[] | undefined = local.tag?.map(asTag);
      const { sdk } = loadClient({ apiKey: opts.apiKey });
      const res = await sdk.memory.search({ query, tags });
      printList(
        res,
        { items: (d) => d.results },
        [
          {
            header: "Score",
            get: (r: SearchMemoryResult) => r.similarity,
            format: (v) => (typeof v === "number" ? v.toFixed(3) : "—"),
          },
          { header: "Memory", get: (r: SearchMemoryResult) => r.memoryPath, width: 36 },
          {
            header: "Heading",
            get: (r: SearchMemoryResult) => r.headingPath.join(" › "),
            width: 32,
          },
          { header: "Content", get: (r: SearchMemoryResult) => r.content, width: 60 },
        ],
        { ...opts, empty: `No matches for "${query}".` },
      );
    } catch (e) {
      handleError(e);
    }
  });

  return cmd;
}
