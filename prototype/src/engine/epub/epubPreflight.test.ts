import { describe, expect, it } from "vitest";
import { zipSync } from "fflate";
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

  it("rejects input larger than 100 MiB before reading the ZIP directory", () => {
    const oversizedInput = new Uint8Array(100 * 1024 * 1024 + 1);

    const result = preflightEpub(oversizedInput);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      code: "ZIP_BOMB_SUSPECTED",
      details: { reasons: ["INPUT_SIZE_LIMIT"] },
    });
  });

  it("reports a missing mimetype together with archive safety failures", () => {
    const unsafeArchive = zipSync({ "bomb.txt": new Uint8Array(10_000) });

    const result = preflightEpub(unsafeArchive);

    expect(result.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["ZIP_BOMB_SUSPECTED", "MIMETYPE_MISSING"]),
    );
  });

  it("preserves mimetype issues when local ZIP data cannot be decompressed", () => {
    const corruptedArchive = zipSync({
      "content.txt": new TextEncoder().encode("chapter content ".repeat(100)),
    });
    const view = new DataView(
      corruptedArchive.buffer,
      corruptedArchive.byteOffset,
      corruptedArchive.byteLength,
    );
    const compressedSize = view.getUint32(18, true);
    const nameLength = view.getUint16(26, true);
    const extraLength = view.getUint16(28, true);
    const compressedDataOffset = 30 + nameLength + extraLength;
    corruptedArchive.fill(0xff, compressedDataOffset, compressedDataOffset + compressedSize);

    const result = preflightEpub(corruptedArchive);

    expect(result.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["MIMETYPE_MISSING", "ZIP_INVALID"]),
    );
  });
});
