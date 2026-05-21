import { describe, expect, test } from "bun:test";
import { paginateAll } from "../src/output.js";

type FakeRes = {
  items: { id: string }[];
  pageData: { page: number; limit: number; total: number; isNextPageAvailable: boolean };
};

describe("paginateAll", () => {
  test("walks every page until isNextPageAvailable is false", async () => {
    const pages: FakeRes[] = [
      {
        items: [{ id: "a" }, { id: "b" }],
        pageData: { page: 1, limit: 2, total: 5, isNextPageAvailable: true },
      },
      {
        items: [{ id: "c" }, { id: "d" }],
        pageData: { page: 2, limit: 2, total: 5, isNextPageAvailable: true },
      },
      {
        items: [{ id: "e" }],
        pageData: { page: 3, limit: 2, total: 5, isNextPageAvailable: false },
      },
    ];
    const calls: number[] = [];
    const { items, last } = await paginateAll<FakeRes, { id: string }>(
      (page) => {
        calls.push(page);
        return Promise.resolve(pages[page - 1]!);
      },
      { items: (d) => d.items, pageData: (d) => d.pageData },
    );
    expect(calls).toEqual([1, 2, 3]);
    expect(items.map((i) => i.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(last.pageData.page).toBe(3);
  });

  test("returns single-page results without extra calls", async () => {
    const only: FakeRes = {
      items: [{ id: "solo" }],
      pageData: { page: 1, limit: 50, total: 1, isNextPageAvailable: false },
    };
    let calls = 0;
    const { items } = await paginateAll<FakeRes, { id: string }>(
      () => {
        calls += 1;
        return Promise.resolve(only);
      },
      { items: (d) => d.items, pageData: (d) => d.pageData },
    );
    expect(calls).toBe(1);
    expect(items).toHaveLength(1);
  });
});
