import Table from "cli-table3";
import pc from "picocolors";
import { stringify as yamlStringify } from "yaml";

export type OutputFormat = "table" | "json" | "jsonl" | "yaml";

export type GlobalOutputOpts = { output?: OutputFormat; noColor?: boolean };

export type PageData = {
  page: number;
  limit: number;
  total: number;
  isNextPageAvailable: boolean;
};

export type Column<T> = {
  header: string;
  get: (row: T) => unknown;
  width?: number;
  format?: (v: unknown) => string;
};

export type ObjectRow<T> = {
  label: string;
  get: (data: T) => unknown;
  format?: (v: unknown) => string;
};

function resolveFormat(opts: GlobalOutputOpts): OutputFormat {
  return opts.output ?? (process.stdout.isTTY ? "table" : "json");
}

function applyNoColor(disable: boolean | undefined): void {
  if (disable || process.env.NO_COLOR) {
    (pc as unknown as { isColorSupported: boolean }).isColorSupported = false;
  }
}

function cell(v: unknown): string {
  if (v === null || v === undefined || v === "") return pc.dim("—");
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.length === 0 ? pc.dim("—") : v.map(cell).join(", ");
  return JSON.stringify(v);
}

export function printList<TResponse, TItem>(
  data: TResponse,
  pick: {
    items: (d: TResponse) => readonly TItem[];
    pageData?: (d: TResponse) => PageData | undefined;
  },
  columns: Column<TItem>[],
  opts: GlobalOutputOpts & { empty?: string } = {},
): void {
  applyNoColor(opts.noColor);
  const format = resolveFormat(opts);

  if (format === "json") {
    process.stdout.write(`${JSON.stringify(data, null, process.stdout.isTTY ? 2 : 0)}\n`);
    return;
  }
  if (format === "yaml") {
    process.stdout.write(yamlStringify(data));
    return;
  }
  if (format === "jsonl") {
    for (const row of pick.items(data)) process.stdout.write(`${JSON.stringify(row)}\n`);
    return;
  }

  const items = pick.items(data);
  if (items.length === 0) {
    process.stdout.write(`${pc.dim(opts.empty ?? "No results.")}\n`);
    return;
  }
  const table = new Table({
    head: columns.map((c) => pc.bold(c.header)),
    style: { head: [], border: ["gray"] },
    colWidths: columns.map((c) => c.width ?? null),
    wordWrap: true,
  });
  for (const row of items) {
    table.push(columns.map((c) => (c.format ? c.format(c.get(row)) : cell(c.get(row)))));
  }
  process.stdout.write(`${table.toString()}\n`);

  const pd = pick.pageData?.(data);
  if (pd) {
    const more = pd.isNextPageAvailable
      ? ` · use ${pc.cyan(`--page ${pd.page + 1}`)} or ${pc.cyan("--all")}`
      : "";
    process.stdout.write(
      `${pc.dim(`page ${pd.page} · ${items.length} of ${pd.total} total${more}`)}\n`,
    );
  }
}

export function printObject<T>(data: T, rows: ObjectRow<T>[], opts: GlobalOutputOpts = {}): void {
  applyNoColor(opts.noColor);
  const format = resolveFormat(opts);

  if (format === "json") {
    process.stdout.write(`${JSON.stringify(data, null, process.stdout.isTTY ? 2 : 0)}\n`);
    return;
  }
  if (format === "yaml") {
    process.stdout.write(yamlStringify(data));
    return;
  }
  if (format === "jsonl") {
    process.stdout.write(`${JSON.stringify(data)}\n`);
    return;
  }

  const table = new Table({ style: { head: [], border: ["gray"] }, wordWrap: true });
  for (const r of rows) {
    const v = r.get(data);
    table.push([pc.bold(r.label), r.format ? r.format(v) : cell(v)]);
  }
  process.stdout.write(`${table.toString()}\n`);
}

export async function paginateAll<TResponse, TItem>(
  fetchPage: (page: number) => Promise<TResponse>,
  pick: { items: (d: TResponse) => readonly TItem[]; pageData: (d: TResponse) => PageData },
): Promise<{ items: TItem[]; last: TResponse }> {
  const all: TItem[] = [];
  let page = 1;
  while (true) {
    const res = await fetchPage(page);
    all.push(...pick.items(res));
    const pd = pick.pageData(res);
    if (!pd.isNextPageAvailable) return { items: all, last: res };
    page = pd.page + 1;
  }
}
