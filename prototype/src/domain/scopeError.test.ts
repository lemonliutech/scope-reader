import { describe, expect, it } from "vitest";
import { blockingIssues, issue } from "./scopeError";

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
