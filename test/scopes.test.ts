import { describe, expect, test } from "bun:test";
import { ALL_SCOPES, SCOPE_DESCRIPTIONS, hasScope, missingScopes } from "../src/scopes.js";

describe("scopes", () => {
  test("every scope has a human-readable description", () => {
    for (const s of ALL_SCOPES) {
      expect(SCOPE_DESCRIPTIONS[s]).toBeDefined();
      expect(SCOPE_DESCRIPTIONS[s].length).toBeGreaterThan(0);
    }
  });

  test("hasScope reports membership", () => {
    expect(hasScope(["MEMORY_READ", "MEMORY_WRITE"], "MEMORY_WRITE")).toBe(true);
    expect(hasScope(["MEMORY_READ"], "MEMORY_WRITE")).toBe(false);
  });

  test("missingScopes returns only the ones not granted", () => {
    const granted = ["MEMORY_READ", "BLOG_READ"];
    expect(missingScopes(granted, ["MEMORY_READ", "MEMORY_WRITE", "BLOG_READ"])).toEqual([
      "MEMORY_WRITE",
    ]);
  });
});
