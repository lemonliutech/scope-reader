import { describe, expect, it } from "vitest";
import { createEpubFixture } from "../../test/createEpubFixture";
import { preflightEpub } from "./epubPreflight";

describe("preflightEpub", () => {
  it("accepts a valid EPUB by content", () => {
    expect(preflightEpub(createEpubFixture()).issues).toEqual([]);
  });

  it("reports a missing container", () => {
    expect(preflightEpub(createEpubFixture({ omitContainer: true })).issues.map((item) => item.code)).toContain(
      "CONTAINER_XML_MISSING",
    );
  });

  it("aggregates fixed layout, scripts and encryption", () => {
    expect(
      preflightEpub(createEpubFixture({ fixedLayout: true, scripted: true, encrypted: true })).issues.map(
        (item) => item.code,
      ),
    ).toEqual(
      expect.arrayContaining([
        "UNSUPPORTED_FIXED_LAYOUT",
        "UNSUPPORTED_SCRIPT_REQUIRED",
        "UNSUPPORTED_ENCRYPTION",
      ]),
    );
  });
});
