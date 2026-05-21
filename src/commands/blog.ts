import type {
  BlogStatus,
  ListAuthorsResponse,
  ListBlogsResponse,
  ListTagsResponse,
} from "@quotientjs/core";
import { Command } from "commander";

type Blog = ListBlogsResponse["blogs"][number];
type BlogAuthor = ListAuthorsResponse["authors"][number];
type BlogTag = ListTagsResponse["tags"][number];
import { loadClient } from "../client.js";
import { handleError } from "../errors.js";
import { attachGlobalFlags, collect, getGlobalOpts } from "../flags.js";
import { paginateAll, printList, printObject } from "../output.js";

const BLOG_ITEMS = {
  items: (d: ListBlogsResponse) => d.blogs,
  pageData: (d: ListBlogsResponse) => d.pageData,
};
const AUTHOR_ITEMS = {
  items: (d: ListAuthorsResponse) => d.authors,
  pageData: (d: ListAuthorsResponse) => d.pageData,
};

export function blogCommand(): Command {
  const cmd = new Command("blog").description("Blog posts, authors, and tags");

  attachGlobalFlags(
    cmd
      .command("get <slug>")
      .description("Fetch a blog post by slug")
      .option("--raw-html", "include rendered HTML"),
  ).action(async function (this: Command, slug: string) {
    try {
      const opts = getGlobalOpts(this);
      const local = this.opts<{ rawHtml?: boolean }>();
      const { sdk } = loadClient({ apiKey: opts.apiKey });
      const res = await sdk.blog.get({ slug, rawHtml: local.rawHtml });
      printObject(
        res,
        [
          { label: "Title", get: (d) => d.blog.title },
          { label: "Slug", get: (d) => d.blog.slug },
          { label: "Published", get: (d) => d.blog.publishDate },
          { label: "Authors", get: (d) => d.blog.authors.map((a) => a.name).join(", ") },
          { label: "Tags", get: (d) => d.blog.tags.map((t) => t.name).join(", ") },
          { label: "Meta", get: (d) => d.blog.metaDescription },
          { label: "Words", get: (d) => d.blog.wordCount },
          { label: "ID", get: (d) => d.blog.id },
        ],
        opts,
      );
    } catch (e) {
      handleError(e);
    }
  });

  attachGlobalFlags(
    cmd
      .command("list")
      .description("List blog posts")
      .option("--author <id>", "(repeatable)", collect)
      .option("--tag <id>", "(repeatable)", collect)
      .option("--status <s>", "DRAFT | SCHEDULED | PUBLISHED (repeatable)", collect)
      .option("--search <q>")
      .option("--page <n>", "", Number, 1)
      .option("--limit <n>", "", Number, 25)
      .option("--all", "fetch every page"),
  ).action(async function (this: Command) {
    try {
      const opts = getGlobalOpts(this);
      const local = this.opts<{
        author?: string[];
        tag?: string[];
        status?: BlogStatus[];
        search?: string;
        page: number;
        limit: number;
        all?: boolean;
      }>();
      const { sdk } = loadClient({ apiKey: opts.apiKey });
      const fetchPage = (page: number) =>
        sdk.blog.list({
          authorIds: local.author,
          tagIds: local.tag,
          statuses: local.status,
          search: local.search,
          page,
          limit: local.limit,
        });

      const columns = [
        { header: "Slug", get: (b: Blog) => b.slug },
        { header: "Title", get: (b: Blog) => b.title, width: 50 },
        { header: "Published", get: (b: Blog) => b.publishDate },
        {
          header: "Authors",
          get: (b: Blog) =>
            b.authors
              .map((a) => a.name)
              .filter(Boolean)
              .join(", "),
          width: 30,
        },
      ];

      if (local.all) {
        const { items, last } = await paginateAll(fetchPage, BLOG_ITEMS);
        printList({ ...last, blogs: items }, { items: (d) => d.blogs }, columns, {
          ...opts,
          empty: "No blog posts.",
        });
      } else {
        const res = await fetchPage(local.page);
        printList(res, BLOG_ITEMS, columns, { ...opts, empty: "No blog posts." });
      }
    } catch (e) {
      handleError(e);
    }
  });

  attachGlobalFlags(
    cmd
      .command("list-authors")
      .description("List blog authors")
      .option("--search <q>")
      .option("--page <n>", "", Number, 1)
      .option("--limit <n>", "", Number, 50)
      .option("--all", "fetch every page"),
  ).action(async function (this: Command) {
    try {
      const opts = getGlobalOpts(this);
      const local = this.opts<{ search?: string; page: number; limit: number; all?: boolean }>();
      const { sdk } = loadClient({ apiKey: opts.apiKey });
      const fetchPage = (page: number) =>
        sdk.blog.listAuthors({ search: local.search, page, limit: local.limit });

      const columns = [
        { header: "Name", get: (a: BlogAuthor) => a.name },
        { header: "Email", get: (a: BlogAuthor) => a.email },
        { header: "ID", get: (a: BlogAuthor) => a.id },
      ];

      if (local.all) {
        const { items, last } = await paginateAll(fetchPage, AUTHOR_ITEMS);
        printList({ ...last, authors: items }, { items: (d) => d.authors }, columns, {
          ...opts,
          empty: "No authors.",
        });
      } else {
        const res = await fetchPage(local.page);
        printList(res, AUTHOR_ITEMS, columns, { ...opts, empty: "No authors." });
      }
    } catch (e) {
      handleError(e);
    }
  });

  attachGlobalFlags(cmd.command("list-tags").description("List blog tags")).action(async function (
    this: Command,
  ) {
    try {
      const opts = getGlobalOpts(this);
      const { sdk } = loadClient({ apiKey: opts.apiKey });
      const res = await sdk.blog.listTags();
      printList(
        res,
        { items: (d) => d.tags },
        [
          { header: "Name", get: (t: BlogTag) => t.name },
          { header: "Description", get: (t: BlogTag) => t.description, width: 50 },
          { header: "ID", get: (t: BlogTag) => t.id },
        ],
        { ...opts, empty: "No tags." },
      );
    } catch (e) {
      handleError(e);
    }
  });

  return cmd;
}
