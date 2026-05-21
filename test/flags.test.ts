import { describe, expect, test } from "bun:test";
import { collect, parseKeyValueList } from "../src/flags.js";

describe("parseKeyValueList", () => {
  test("returns undefined for empty input", () => {
    expect(parseKeyValueList(undefined)).toBeUndefined();
    expect(parseKeyValueList([])).toBeUndefined();
  });

  test("parses key=value pairs", () => {
    expect(parseKeyValueList(["a=1", "b=two"])).toEqual({ a: "1", b: "two" });
  });

  test("keeps everything after the first = sign as the value", () => {
    expect(parseKeyValueList(["url=https://example.com/path?q=1"])).toEqual({
      url: "https://example.com/path?q=1",
    });
  });

  test("rejects entries with no = sign", () => {
    expect(() => parseKeyValueList(["no-equals"])).toThrow(/key=value/);
  });
});

describe("collect", () => {
  test("appends to the accumulator", () => {
    expect(collect("a", undefined)).toEqual(["a"]);
    expect(collect("b", ["a"])).toEqual(["a", "b"]);
  });
});
