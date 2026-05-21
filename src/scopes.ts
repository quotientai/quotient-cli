export const ALL_SCOPES = [
  "ANALYTICS_READ",
  "ANALYTICS_WRITE",
  "AUDIENCE_READ",
  "AUDIENCE_WRITE",
  "BLOG_READ",
  "BLOG_WRITE",
  "FLOW_TRIGGER",
  "MEMORY_READ",
  "MEMORY_WRITE",
] as const;

export type Scope = (typeof ALL_SCOPES)[number];

export const SCOPE_DESCRIPTIONS: Record<Scope, string> = {
  ANALYTICS_READ: "Read analytics events",
  ANALYTICS_WRITE: "Write analytics events",
  AUDIENCE_READ: "Read people, companies, and lists",
  AUDIENCE_WRITE: "Create or update people, companies, and lists",
  BLOG_READ: "Read blog posts and authors",
  BLOG_WRITE: "Create or update blog posts",
  FLOW_TRIGGER: "Trigger flow enrollments",
  MEMORY_READ: "Read memory documents and folders",
  MEMORY_WRITE: "Create, update, or delete memory documents and folders",
};

export function hasScope(granted: readonly string[], required: Scope): boolean {
  return granted.includes(required);
}

export function missingScopes(granted: readonly string[], required: readonly Scope[]): Scope[] {
  return required.filter((s) => !granted.includes(s));
}
