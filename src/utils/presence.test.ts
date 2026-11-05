import { describe, expect, test } from "vitest";
import { findArrivals, REANNOUNCE_AFTER_MS } from "./presence";

const NOW = 1_000_000_000;

describe("findArrivals", () => {
  test("someone not seen before has arrived", () => {
    const ana = { userId: "ana", updatedAt: NOW };
    expect(findArrivals(new Map(), [ana])).toEqual([ana]);
  });

  test("a heartbeat from someone already here is not an arrival", () => {
    expect(findArrivals(new Map([["ana", NOW - 15_000]]), [{ userId: "ana", updatedAt: NOW }])).toEqual([]);
  });

  test("someone back after a short absence is not announced again", () => {
    expect(findArrivals(new Map([["ana", NOW - REANNOUNCE_AFTER_MS]]), [{ userId: "ana", updatedAt: NOW }])).toEqual([]);
  });

  test("someone back after a long absence is announced again", () => {
    const ana = { userId: "ana", updatedAt: NOW };
    expect(findArrivals(new Map([["ana", NOW - REANNOUNCE_AFTER_MS - 1]]), [ana])).toEqual([ana]);
  });

  test("only the new person is picked out", () => {
    const ben = { userId: "ben", updatedAt: NOW };
    expect(findArrivals(new Map([["ana", NOW - 15_000]]), [{ userId: "ana", updatedAt: NOW }, ben])).toEqual([ben]);
  });
});
