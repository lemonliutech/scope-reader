import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChapterDocument, PublicationInspection, PublicationSource } from "../domain/publication";
import { issue, ScopeException } from "../domain/scopeError";
import type { PublicationEngine, PublicationSession } from "../engine/PublicationEngine";
import { PublicationEngineRegistry } from "../engine/PublicationEngineRegistry";
import { IndexedDbLibraryRepository } from "../storage/IndexedDbLibraryRepository";
import { ReaderService } from "./ReaderService";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  vi.restoreAllMocks();
});

function makeInspection(): PublicationInspection {
  return {
    metadata: { title: "Book", authors: [], language: null, description: null, cover: null },
    navigation: [],
    readingOrder: [{ id: "c1", label: "Ch1", target: { format: "EPUB", locator: "ch.xhtml" }, linear: true }],
    issues: [],
  };
}

function makeSession(inspection = makeInspection()): PublicationSession {
  return {
    getInspection: () => inspection,
    loadChapter: vi.fn().mockResolvedValue({ id: "ch", title: "Ch", html: "<p/>", baseUrl: "", warnings: [] } as ChapterDocument),
    getLocation: () => ({ format: "EPUB", locator: "ch.xhtml", chapterIndex: 0, scrollRatio: 0 }),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

function makeEngine(session = makeSession()): PublicationEngine {
  return {
    format: "EPUB",
    canOpen: vi.fn().mockResolvedValue(100),
    inspect: vi.fn().mockResolvedValue(makeInspection()),
    open: vi.fn().mockResolvedValue(session),
  };
}

function makeFile(name = "book.epub", content = "PK..."): File {
  return new File([content], name, { type: "application/epub+zip" });
}

describe("ReaderService", () => {
  it("importFile emits stages in order", async () => {
    const engine = makeEngine();
    const registry = new PublicationEngineRegistry([engine]);
    const repo = new IndexedDbLibraryRepository();
    const service = new ReaderService(registry, repo);

    const stages: string[] = [];
    const result = await service.importFile(makeFile(), (p) => stages.push(p.stage));

    expect(stages).toEqual([
      "READ_FILE",
      "DETECT_FORMAT",
      "INSPECT_PUBLICATION",
      "CHECK_CAPABILITIES",
      "PREPARE_PUBLICATION",
      "PERSIST_PUBLICATION",
      "OPEN_READER",
    ]);
    expect(result.issues).toHaveLength(0);
    expect(result.bookId).not.toBeNull();
  });

  it("importFile does not call repository when blocking issues exist", async () => {
    const engine: PublicationEngine = {
      format: "EPUB",
      canOpen: vi.fn().mockResolvedValue(100),
      inspect: vi.fn().mockResolvedValue({
        ...makeInspection(),
        issues: [issue("UNSUPPORTED_DRM", "CHECK_CAPABILITIES", true)],
      }),
      open: vi.fn(),
    };
    const registry = new PublicationEngineRegistry([engine]);
    const repo = new IndexedDbLibraryRepository();
    const importSpy = vi.spyOn(repo, "importBook");
    const service = new ReaderService(registry, repo);

    const result = await service.importFile(makeFile(), () => {});

    expect(importSpy).not.toHaveBeenCalled();
    expect(result.issues.some((i) => i.code === "UNSUPPORTED_DRM")).toBe(true);
    expect(result.bookId).toBeNull();
  });

  it("opening second book destroys first session", async () => {
    const session1 = makeSession();
    const session2 = makeSession();
    let callCount = 0;
    const engine: PublicationEngine = {
      format: "EPUB",
      canOpen: vi.fn().mockResolvedValue(100),
      inspect: vi.fn().mockResolvedValue(makeInspection()),
      open: vi.fn().mockImplementation(() => Promise.resolve(callCount++ === 0 ? session1 : session2)),
    };
    const registry = new PublicationEngineRegistry([engine]);
    const repo = new IndexedDbLibraryRepository();
    const service = new ReaderService(registry, repo);

    await service.importFile(makeFile("a.epub"), () => {});
    await service.importFile(makeFile("b.epub"), () => {});

    expect(session1.destroy).toHaveBeenCalledOnce();
  });

  it("destroy failure adds non-blocking ENGINE_DISPOSE_FAILED issue to next result", async () => {
    const session1 = makeSession();
    (session1.destroy as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("gpu crash"));
    const session2 = makeSession();
    let callCount = 0;
    const engine: PublicationEngine = {
      format: "EPUB",
      canOpen: vi.fn().mockResolvedValue(100),
      inspect: vi.fn().mockResolvedValue(makeInspection()),
      open: vi.fn().mockImplementation(() => Promise.resolve(callCount++ === 0 ? session1 : session2)),
    };
    const registry = new PublicationEngineRegistry([engine]);
    const repo = new IndexedDbLibraryRepository();
    const service = new ReaderService(registry, repo);

    await service.importFile(makeFile("a.epub"), () => {});
    const result = await service.importFile(makeFile("b.epub"), () => {});

    expect(result.issues.some((i) => i.code === "ENGINE_DISPOSE_FAILED" && !i.blocking)).toBe(true);
  });

  it("falls back to in-memory (temporary) when IndexedDB is unavailable", async () => {
    const engine = makeEngine();
    const registry = new PublicationEngineRegistry([engine]);
    const repo = new IndexedDbLibraryRepository();
    vi.spyOn(repo, "importBook").mockRejectedValue(
      new ScopeException([issue("INDEXEDDB_UNAVAILABLE", "OPEN_DATABASE", true)]),
    );
    const service = new ReaderService(registry, repo);

    const result = await service.importFile(makeFile(), () => {});

    expect(result.temporary).toBe(true);
    expect(result.bookId).not.toBeNull();
  });
});
