import type {
  AddPeopleEntry,
  CustomProperties,
  EmailSubscriptionStatus,
  ListItem,
  ListListsResponse,
  ListPeopleInListResponse,
  PersonInList,
  RemovePeopleEntry,
  UpsertCompanyOptions,
  UpsertListOptions,
  UpsertPersonOptions,
} from "@quotientjs/core";
import { Command } from "commander";
import { loadClient } from "../client.js";
import { CLIError, ExitCode, handleError } from "../errors.js";
import { attachGlobalFlags, collect, getGlobalOpts, parseKeyValueList } from "../flags.js";
import { paginateAll, printList, printObject } from "../output.js";

const LIST_ITEMS = {
  items: (d: ListListsResponse) => d.lists,
  pageData: (d: ListListsResponse) => d.pageData,
};
const PEOPLE_ITEMS = {
  items: (d: ListPeopleInListResponse) => d.people,
  pageData: (d: ListPeopleInListResponse) => d.pageData,
};

export function audienceCommand(): Command {
  return new Command("audience")
    .description("People, companies, and lists")
    .addCommand(peopleGroup())
    .addCommand(companiesGroup())
    .addCommand(listsGroup());
}

function peopleGroup(): Command {
  const group = new Command("people").description("Manage people in your audience");

  attachGlobalFlags(
    group
      .command("upsert")
      .description("Create or update a person by email")
      .requiredOption("--email <email>", "primary email address")
      .option("--first-name <name>")
      .option("--last-name <name>")
      .option("--job-title <title>")
      .option("--lead-score <n>", "0–100", Number)
      .option("--subscription <state>", "SUBSCRIBED | UNSUBSCRIBED | PENDING | BOUNCED | SPAM")
      .option("--list <slug>", "list slug (repeatable)", collect)
      .option("--property <key=value>", "custom property (repeatable)", collect),
  ).action(async function (this: Command) {
    try {
      const opts = getGlobalOpts(this);
      const local = this.opts<{
        email: string;
        firstName?: string;
        lastName?: string;
        jobTitle?: string;
        leadScore?: number;
        subscription?: EmailSubscriptionStatus;
        list?: string[];
        property?: string[];
      }>();
      const body: UpsertPersonOptions = {
        emailAddress: local.email,
        ...(local.firstName && { firstName: local.firstName }),
        ...(local.lastName && { lastName: local.lastName }),
        ...(local.jobTitle && { jobTitle: local.jobTitle }),
        ...(local.leadScore !== undefined && { leadScore: local.leadScore }),
        ...(local.subscription && { emailSubscriptionStatus: local.subscription }),
        ...(local.list && { lists: local.list }),
        ...(parseKeyValueList(local.property) && {
          properties: parseKeyValueList(local.property) as CustomProperties,
        }),
      };
      const { sdk } = loadClient({ apiKey: opts.apiKey });
      const res = await sdk.audience.people.upsert(body);
      printObject(
        res,
        [
          { label: "Person ID", get: (d) => d.personId },
          { label: "Email", get: () => local.email },
        ],
        opts,
      );
    } catch (e) {
      handleError(e);
    }
  });

  return group;
}

function companiesGroup(): Command {
  const group = new Command("companies").description("Manage companies in your audience");

  attachGlobalFlags(
    group
      .command("upsert")
      .description("Create or update a company by domain")
      .requiredOption("--domain <domain>")
      .option("--name <name>")
      .option("--description <text>")
      .option("--industry <industry>", "(repeatable)", collect)
      .option("--revenue <n>", "annual revenue", Number)
      .option("--revenue-currency <code>", "ISO currency code, e.g. USD")
      .option("--total-employees <n>", "", Number)
      .option("--address1 <line>")
      .option("--address2 <line>")
      .option("--city <city>")
      .option("--region-code <code>")
      .option("--country <country>")
      .option("--zip <zip>")
      .option("--linkedin <url>")
      .option("--property <key=value>", "(repeatable)", collect),
  ).action(async function (this: Command) {
    try {
      const opts = getGlobalOpts(this);
      const local = this.opts<{
        domain: string;
        name?: string;
        description?: string;
        industry?: string[];
        revenue?: number;
        revenueCurrency?: string;
        totalEmployees?: number;
        address1?: string;
        address2?: string;
        city?: string;
        regionCode?: string;
        country?: string;
        zip?: string;
        linkedin?: string;
        property?: string[];
      }>();
      const props = parseKeyValueList(local.property);
      const body: UpsertCompanyOptions = {
        domain: local.domain,
        ...(local.name && { name: local.name }),
        ...(local.description && { description: local.description }),
        ...(local.industry && { industries: local.industry }),
        ...(local.revenue !== undefined && { revenue: local.revenue }),
        ...(local.revenueCurrency && { revenueCurrency: local.revenueCurrency }),
        ...(local.totalEmployees !== undefined && { totalEmployees: local.totalEmployees }),
        ...(local.address1 && { address1: local.address1 }),
        ...(local.address2 && { address2: local.address2 }),
        ...(local.city && { city: local.city }),
        ...(local.regionCode && { regionCode: local.regionCode }),
        ...(local.country && { country: local.country }),
        ...(local.zip && { zip: local.zip }),
        ...(local.linkedin && { socialLinkLinkedIn: local.linkedin }),
        ...(props && { properties: props as CustomProperties }),
      };
      const { sdk } = loadClient({ apiKey: opts.apiKey });
      const res = await sdk.audience.companies.upsert(body);
      printObject(
        res,
        [
          { label: "Company ID", get: (d) => d.companyId },
          { label: "Domain", get: () => local.domain },
        ],
        opts,
      );
    } catch (e) {
      handleError(e);
    }
  });

  return group;
}

function listsGroup(): Command {
  const group = new Command("lists").description("Manage audience lists");

  const listColumns = [
    { header: "Slug", get: (l: ListItem) => l.slug },
    { header: "Name", get: (l: ListItem) => l.name, width: 36 },
    { header: "People", get: (l: ListItem) => l.peopleCount },
    { header: "Description", get: (l: ListItem) => l.description, width: 50 },
    { header: "ID", get: (l: ListItem) => l.id },
  ];

  const personColumns = [
    { header: "Email", get: (p: PersonInList) => p.emailAddress },
    { header: "First", get: (p: PersonInList) => p.firstName },
    { header: "Last", get: (p: PersonInList) => p.lastName },
    { header: "Person ID", get: (p: PersonInList) => p.personId },
  ];

  attachGlobalFlags(
    group
      .command("list")
      .description("List audience lists")
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
        sdk.audience.lists.list({ search: local.search, page, limit: local.limit });

      if (local.all) {
        const { items, last } = await paginateAll(fetchPage, LIST_ITEMS);
        printList({ ...last, lists: items }, { items: (d) => d.lists }, listColumns, {
          ...opts,
          empty: "No lists.",
        });
      } else {
        const res = await fetchPage(local.page);
        printList(res, LIST_ITEMS, listColumns, { ...opts, empty: "No lists." });
      }
    } catch (e) {
      handleError(e);
    }
  });

  attachGlobalFlags(
    group.command("get <slug>").description("Get one audience list by slug"),
  ).action(async function (this: Command, slug: string) {
    try {
      const opts = getGlobalOpts(this);
      const { sdk } = loadClient({ apiKey: opts.apiKey });
      const res = await sdk.audience.lists.get({ slug });
      printObject(
        res,
        [
          { label: "Slug", get: (d) => d.list.slug },
          { label: "Name", get: (d) => d.list.name },
          { label: "People", get: (d) => d.list.peopleCount },
          { label: "Description", get: (d) => d.list.description },
          { label: "Created", get: (d) => d.list.createdAt },
          { label: "Updated", get: (d) => d.list.updatedAt },
          { label: "List ID", get: (d) => d.list.id },
        ],
        opts,
      );
    } catch (e) {
      handleError(e);
    }
  });

  attachGlobalFlags(
    group
      .command("upsert")
      .description("Create or update an audience list (provide --name or --slug)")
      .option("--name <name>")
      .option("--slug <slug>")
      .option("--description <text>"),
  ).action(async function (this: Command) {
    try {
      const opts = getGlobalOpts(this);
      const local = this.opts<{ name?: string; slug?: string; description?: string }>();
      if (!local.name && !local.slug) {
        throw new CLIError("Provide at least one of --name or --slug.", {
          code: "USAGE",
          exitCode: ExitCode.Usage,
        });
      }
      const body: UpsertListOptions = local.slug
        ? { slug: local.slug, name: local.name, description: local.description }
        : { name: local.name as string, description: local.description };
      const { sdk } = loadClient({ apiKey: opts.apiKey });
      const res = await sdk.audience.lists.upsert(body);
      printObject(
        res,
        [
          { label: "List ID", get: (d) => d.listId },
          { label: "Slug", get: (d) => d.slug },
          { label: "Name", get: (d) => d.name },
        ],
        opts,
      );
    } catch (e) {
      handleError(e);
    }
  });

  attachGlobalFlags(
    group
      .command("list-people <slug>")
      .description("List people in an audience list")
      .option("--search <q>")
      .option("--page <n>", "", Number, 1)
      .option("--limit <n>", "", Number, 50)
      .option("--all", "fetch every page"),
  ).action(async function (this: Command, slug: string) {
    try {
      const opts = getGlobalOpts(this);
      const local = this.opts<{ search?: string; page: number; limit: number; all?: boolean }>();
      const { sdk } = loadClient({ apiKey: opts.apiKey });
      const fetchPage = (page: number) =>
        sdk.audience.lists.listPeople({
          listSlug: slug,
          search: local.search,
          page,
          limit: local.limit,
        });

      if (local.all) {
        const { items, last } = await paginateAll(fetchPage, PEOPLE_ITEMS);
        printList({ ...last, people: items }, { items: (d) => d.people }, personColumns, {
          ...opts,
          empty: "No people in this list.",
        });
      } else {
        const res = await fetchPage(local.page);
        printList(res, PEOPLE_ITEMS, personColumns, { ...opts, empty: "No people in this list." });
      }
    } catch (e) {
      handleError(e);
    }
  });

  attachGlobalFlags(
    group
      .command("add-people <slug>")
      .description("Add people to a list by email or personId")
      .option("--email <email>", "(repeatable)", collect)
      .option("--person-id <id>", "(repeatable)", collect),
  ).action(async function (this: Command, slug: string) {
    try {
      const opts = getGlobalOpts(this);
      const local = this.opts<{ email?: string[]; personId?: string[] }>();
      const people: AddPeopleEntry[] = [
        ...(local.personId ?? []).map((id) => ({ personId: id })),
        ...(local.email ?? []).map((e) => ({ emailAddress: e })),
      ];
      if (people.length === 0) {
        throw new CLIError("Provide at least one --email or --person-id.", {
          code: "USAGE",
          exitCode: ExitCode.Usage,
        });
      }
      const { sdk } = loadClient({ apiKey: opts.apiKey });
      const res = await sdk.audience.lists.addPeople({ listSlug: slug, people });
      printObject(
        res,
        [
          { label: "Added", get: (d) => d.added },
          { label: "List slug", get: (d) => d.listSlug },
          { label: "List ID", get: (d) => d.listId },
        ],
        opts,
      );
    } catch (e) {
      handleError(e);
    }
  });

  attachGlobalFlags(
    group
      .command("remove-people <slug>")
      .description("Remove people from a list by email or personId")
      .option("--email <email>", "(repeatable)", collect)
      .option("--person-id <id>", "(repeatable)", collect),
  ).action(async function (this: Command, slug: string) {
    try {
      const opts = getGlobalOpts(this);
      const local = this.opts<{ email?: string[]; personId?: string[] }>();
      const people: RemovePeopleEntry[] = [
        ...(local.personId ?? []).map((id) => ({ personId: id })),
        ...(local.email ?? []).map((e) => ({ emailAddress: e })),
      ];
      if (people.length === 0) {
        throw new CLIError("Provide at least one --email or --person-id.", {
          code: "USAGE",
          exitCode: ExitCode.Usage,
        });
      }
      const { sdk } = loadClient({ apiKey: opts.apiKey });
      const res = await sdk.audience.lists.removePeople({ listSlug: slug, people });
      printObject(
        res,
        [
          { label: "Removed", get: (d) => d.removed },
          { label: "List slug", get: (d) => d.listSlug },
          { label: "List ID", get: (d) => d.listId },
        ],
        opts,
      );
    } catch (e) {
      handleError(e);
    }
  });

  return group;
}
