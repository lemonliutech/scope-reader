import { describe, expect, expectTypeOf, it } from "vitest";
import { blockingIssues, issue, ScopeException } from "./scopeError";
import type { ScopeIssue } from "./scopeError";

describe("blockingIssues", () => {
  it("returns every blocking issue without mutating or hiding warnings", () => {
    const issues = [
      issue("NAVIGATION_INVALID", "INSPECT_PUBLICATION", false),
      issue("UNSUPPORTED_FIXED_LAYOUT", "CHECK_CAPABILITIES", true),
      issue("UNSUPPORTED_DRM", "CHECK_CAPABILITIES", true),
    ];

    expect(blockingIssues(issues).map(({ code }) => code)).toEqual([
      "UNSUPPORTED_FIXED_LAYOUT",
      "UNSUPPORTED_DRM",
    ]);
    expect(issues.map(({ code }) => code)).toEqual([
      "NAVIGATION_INVALID",
      "UNSUPPORTED_FIXED_LAYOUT",
      "UNSUPPORTED_DRM",
    ]);
  });
});

describe("ScopeException", () => {
  it("keeps the issue array and joins every message with a Chinese semicolon", () => {
    const issues = [
      issue("UNSUPPORTED_FIXED_LAYOUT", "CHECK_CAPABILITIES", true),
      issue("UNSUPPORTED_DRM", "CHECK_CAPABILITIES", true),
    ];

    const exception = new ScopeException(issues);

    expect(exception.issues).toBe(issues);
    expect(exception.message).toBe(`${issues[0]?.userMessage}；${issues[1]?.userMessage}`);
    expectTypeOf(exception.issues).toEqualTypeOf<ScopeIssue[]>();
  });
});
