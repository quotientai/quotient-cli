import { describe, expect, test } from "bun:test";
import { configDir, maskKey } from "../src/config.js";

describe("maskKey", () => {
  test("masks a long key keeping the last 4 chars", () => {
    expect(maskKey("sk_abcdefghijklmnop")).toBe("sk_****mnop");
  });

  test("short keys get a generic mask", () => {
    expect(maskKey("sk_x")).toBe("sk_****");
  });
});

describe("configDir", () => {
  test("respects XDG_CONFIG_HOME when set", () => {
    const prev = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = "/tmp/xdg-test";
    try {
      expect(configDir()).toBe("/tmp/xdg-test/quotient");
    } finally {
      // biome-ignore lint/performance/noDelete: canonical way to unset an env var
      if (prev === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = prev;
    }
  });

  test("falls back to ~/.config when unset", () => {
    const prev = process.env.XDG_CONFIG_HOME;
    // biome-ignore lint/performance/noDelete: canonical way to unset an env var
    delete process.env.XDG_CONFIG_HOME;
    try {
      expect(configDir()).toMatch(/\/\.config\/quotient$/);
    } finally {
      if (prev !== undefined) process.env.XDG_CONFIG_HOME = prev;
    }
  });
});
