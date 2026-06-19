import { describe, expect, it } from "vitest";
import { createEpubFixture } from "../../test/createEpubFixture";
import { EpubJsDriver } from "./EpubJsDriver";

const BANNED_CONSTRUCTOR_NAMES = new Set(["Book", "Rendition", "Spine"]);

describe("EpubJsDriver", () => {
  it("inspects real epub fixture without leaking epub.js instances", async () => {
    const driver = new EpubJsDriver();
    const bytes = createArrayBuffer(createEpubFixture({
      title: "测试标题",
      author: "测试作者",
    }));

    const inspection = await driver.inspect(bytes);

    expect(inspection.metadata).toMatchObject({
      title: "测试标题",
      creator: "测试作者",
      language: "zh-CN",
    });
    expect(inspection.navigation).toEqual([
      expect.objectContaining({
        href: "chapter.xhtml#start",
        label: "第一章",
      }),
    ]);
    expect(inspection.spine).toEqual([
      expect.objectContaining({
        href: "chapter.xhtml",
        linear: true,
      }),
    ]);
    expectNoThirdPartyInstances(inspection);

    await driver.destroy();
  });

  it("opens and loads chapter html from the reading spine", async () => {
    const driver = new EpubJsDriver();
    const bytes = createArrayBuffer(createEpubFixture());

    await driver.open(bytes);
    const chapter = await driver.loadChapter("chapter.xhtml#start");

    expect(chapter.href).toBe("chapter.xhtml");
    expect(chapter.html).toContain('<h1 id="start">开始</h1>');
    expect(Array.isArray(chapter.objectUrls)).toBe(true);
    expectNoThirdPartyInstances(chapter);

    await driver.destroy();
  });
});

function expectNoThirdPartyInstances(value: unknown): void {
  visit(value, new Set<object>());
}

function createArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function visit(value: unknown, seen: Set<object>): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  const constructorName = value.constructor?.name;
  expect(BANNED_CONSTRUCTOR_NAMES.has(constructorName)).toBe(false);

  if (Array.isArray(value)) {
    value.forEach((item) => visit(item, seen));
    return;
  }

  Object.values(value).forEach((item) => visit(item, seen));
}
