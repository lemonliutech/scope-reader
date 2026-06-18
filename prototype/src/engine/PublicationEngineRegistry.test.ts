import { describe, expect, expectTypeOf, it } from "vitest";
import type { PublicationSource, PublicationTarget } from "../domain/publication";
import { ScopeException } from "../domain/scopeError";
import type { PublicationEngine, PublicationSession } from "./PublicationEngine";
import { PublicationEngineRegistry } from "./PublicationEngineRegistry";

const source: PublicationSource = {
  fileName: "book.epub",
  mediaType: "application/epub+zip",
  size: 0,
  data: new ArrayBuffer(0),
};

function fakeEngine(confidence: 0 | 20 | 100): PublicationEngine {
  return engineWithCanOpen(async () => confidence);
}

function engineWithCanOpen(canOpen: PublicationEngine["canOpen"]): PublicationEngine {
  return {
    format: "EPUB",
    canOpen,
    inspect: async () => {
      throw new Error("not used");
    },
    open: async () => {
      throw new Error("not used");
    },
  };
}

describe("PublicationEngineRegistry", () => {
  it("selects the engine with the highest confidence", async () => {
    const lowConfidence = fakeEngine(20);
    const highConfidence = fakeEngine(100);
    const registry = new PublicationEngineRegistry([lowConfidence, highConfidence]);

    await expect(registry.select(source)).resolves.toBe(highConfidence);
  });

  it("throws FORMAT_ENGINE_NOT_FOUND when every confidence is zero", async () => {
    const registry = new PublicationEngineRegistry([fakeEngine(0), fakeEngine(0)]);

    try {
      await registry.select(source);
      expect.fail("select should reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ScopeException);
      expect((error as ScopeException).issues[0]?.code).toBe("FORMAT_ENGINE_NOT_FOUND");
    }
  });

  it("isolates an engine that throws synchronously during detection", async () => {
    const throwingEngine = engineWithCanOpen(() => {
      throw new Error("sync detection failure");
    });
    const registry = new PublicationEngineRegistry([throwingEngine, fakeEngine(0)]);

    await expect(registry.select(source)).rejects.toMatchObject({
      issues: [{ code: "FORMAT_ENGINE_NOT_FOUND" }],
    });
  });

  it("isolates an engine whose detection promise rejects", async () => {
    const rejectingEngine = engineWithCanOpen(async () => {
      throw new Error("async detection failure");
    });
    const registry = new PublicationEngineRegistry([rejectingEngine, fakeEngine(0)]);

    await expect(registry.select(source)).rejects.toMatchObject({
      issues: [{ code: "FORMAT_ENGINE_NOT_FOUND" }],
    });
  });

  it("selects an available engine when other detections fail", async () => {
    const throwingEngine = engineWithCanOpen(() => {
      throw new Error("sync detection failure");
    });
    const rejectingEngine = engineWithCanOpen(async () => {
      throw new Error("async detection failure");
    });
    const availableEngine = fakeEngine(20);
    const registry = new PublicationEngineRegistry([
      throwingEngine,
      availableEngine,
      rejectingEngine,
    ]);

    await expect(registry.select(source)).resolves.toBe(availableEngine);
  });

  it("reports ENGINE_LOAD_FAILED with the failure count when every detection fails", async () => {
    const registry = new PublicationEngineRegistry([
      engineWithCanOpen(() => {
        throw new Error("sync detection failure");
      }),
      engineWithCanOpen(async () => {
        throw new Error("async detection failure");
      }),
    ]);

    await expect(registry.select(source)).rejects.toMatchObject({
      issues: [{ code: "ENGINE_LOAD_FAILED", details: { failureCount: 2 } }],
    });
  });

  it("keeps registration order when engines have equal confidence", async () => {
    const firstEngine = fakeEngine(100);
    const secondEngine = fakeEngine(100);
    const registry = new PublicationEngineRegistry([firstEngine, secondEngine]);

    await expect(registry.select(source)).resolves.toBe(firstEngine);
  });

  it("exposes the format-independent session and engine signatures", () => {
    expectTypeOf<Parameters<PublicationSession["loadChapter"]>[0]>()
      .toEqualTypeOf<PublicationTarget>();
    expectTypeOf<Parameters<PublicationEngine["open"]>>()
      .toEqualTypeOf<[source: PublicationSource]>();
  });
});
