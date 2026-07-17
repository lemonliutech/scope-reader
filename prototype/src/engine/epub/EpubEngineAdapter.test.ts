import { describe, expect, it } from "vitest";
import type { PublicationSource } from "../../domain/publication";
import { createEpubFixture } from "../../test/createEpubFixture";
import { EpubEngineAdapter } from "./EpubEngineAdapter";
import { EpubJsDriver } from "./EpubJsDriver";

describe("EpubEngineAdapter", () => {
  it("normalizes real epub inspection and chapter loading", async () => {
    const source = createSource(createEpubFixture({
      title: "适配器标题",
      author: "适配器作者",
    }));
    const adapter = new EpubEngineAdapter(() => new EpubJsDriver());

    const confidence = await adapter.canOpen(source);
    const inspection = await adapter.inspect(source);
    const session = await adapter.open(source);
    const chapter = await session.loadChapter({
      format: "EPUB",
      locator: "chapter.xhtml#start",
    });

    expect(confidence).toBe(100);
    expect(inspection.metadata).toMatchObject({
      title: "适配器标题",
      authors: ["适配器作者"],
      language: "zh-CN",
    });
    expect(inspection.navigation).toEqual([
      expect.objectContaining({
        id: "root:0:chapter.xhtml#start",
        target: { format: "EPUB", locator: "chapter.xhtml#start" },
      }),
    ]);
    expect(inspection.readingOrder).toEqual([
      expect.objectContaining({
        target: { format: "EPUB", locator: "chapter.xhtml" },
        linear: true,
      }),
    ]);
    expect(chapter.html).toContain('<h1 id="start">开始</h1>');
    expectNoThirdPartyInstances(inspection);
    expectNoThirdPartyInstances(chapter);

    await session.destroy();
  });

  it("opens a readable EPUB when directory entries precede mimetype", async () => {
    const source = createSource(createEpubFixture({ mimetypeNotFirst: true }));
    const adapter = new EpubEngineAdapter(() => new EpubJsDriver());

    expect(await adapter.canOpen(source)).toBe(100);
    await expect(adapter.inspect(source)).resolves.toMatchObject({
      metadata: { title: "Scope Test Book" },
      issues: [],
    });

    const session = await adapter.open(source);
    await expect(session.loadChapter({ format: "EPUB", locator: "chapter.xhtml" }))
      .resolves.toMatchObject({ html: expect.stringContaining("开始") });
    await session.destroy();
  });

  it("builds fallback navigation warning from reading order when driver navigation is empty", async () => {
    const source = createSource(createEpubFixture());
    const adapter = new EpubEngineAdapter(() => ({
      async inspect() {
        return {
          metadata: { title: "空目录", creator: "作者" },
          navigation: [],
          spine: [{ id: "chapter", href: "chapter.xhtml", linear: true }],
          cover: null,
        };
      },
      async open() {},
      async loadChapter(href: string) {
        return { href, html: '<h1 id="start">开始</h1>', objectUrls: [] };
      },
      async destroy() {},
    } as unknown as EpubJsDriver));

    const inspection = await adapter.inspect(source);

    expect(inspection.navigation).toEqual([
      expect.objectContaining({
        id: "root:0:chapter.xhtml",
        label: "chapter.xhtml",
      }),
    ]);
    expect(inspection.issues.map((item) => item.code)).toContain("NAVIGATION_INVALID");
  });

  it("keeps fixed-layout preflight issue codes", async () => {
    const source = createSource(createEpubFixture({ fixedLayout: true }));
    const adapter = new EpubEngineAdapter(() => ({
      async inspect() {
        return {
          metadata: { title: "固定版式", creator: "作者" },
          navigation: [],
          spine: [{ id: "chapter", href: "chapter.xhtml", linear: true }],
          cover: null,
        };
      },
      async open() {},
      async loadChapter(href: string) {
        return { href, html: '<h1 id="start">开始</h1>', objectUrls: [] };
      },
      async destroy() {},
    } as unknown as EpubJsDriver));

    const inspection = await adapter.inspect(source);

    expect(inspection.issues.map((item) => item.code)).toContain("UNSUPPORTED_FIXED_LAYOUT");
  });
});

function createSource(bytes: Uint8Array, fileName = "book.epub"): PublicationSource {
  return {
    fileName,
    mediaType: "application/epub+zip",
    size: bytes.byteLength,
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  };
}

const BANNED_CONSTRUCTOR_NAMES = new Set(["Book", "Rendition", "Spine"]);

function expectNoThirdPartyInstances(value: unknown): void {
  visit(value, new Set<object>());
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
