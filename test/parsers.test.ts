import { describe, expect, it } from "vitest";

import {
  parseEpochMilliseconds,
  parseEpochSeconds,
  parseHmsMilliseconds,
  parseOptionalMilliseconds,
  parseRuntimeMilliseconds,
  parseUptimeMilliseconds,
} from "../src/index.js";

describe("controller parsers", () => {
  it("parses duration formats into explicit milliseconds", () => {
    expect(parseRuntimeMilliseconds("1d 04h 33m 12s")).toBe(102_792_000);
    expect(parseHmsMilliseconds("04:33:12")).toBe(16_392_000);
    expect(parseUptimeMilliseconds("250d 11h 48m")).toBe(21_642_480_000);
    expect(parseOptionalMilliseconds("1.5")).toBe(1_500);
    expect(parseOptionalMilliseconds("NONE")).toBeUndefined();
  });

  it("parses epoch values as UTC dates", () => {
    expect(parseEpochSeconds(1_700_000_000)?.toISOString()).toBe("2023-11-14T22:13:20.000Z");
    expect(parseEpochMilliseconds(1_700_000_000_000)?.toISOString()).toBe(
      "2023-11-14T22:13:20.000Z",
    );
    expect(parseEpochSeconds(0)).toBeUndefined();
  });
});
