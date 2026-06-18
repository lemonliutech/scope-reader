import { describe, expect, it } from "vitest";
import type { PublicationSource } from "../domain/publication";
import { ScopeException } from "../domain/scopeError";
import type { PublicationEngine } from "./PublicationEngine";
import { PublicationEngineRegistry } from "./PublicationEngineRegistry";

const source: PublicationSource = {
  fileName: "book.epub",
  mediaType: "application/epub+zip",
  size: 0,
  data: new ArrayBuffer(0),
};

function fakeEngine(confidence: 0 | 20 | 100): PublicationEngine {
  return {
    format: "EPUB",
    canOpen: async () => confidence,
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

    await expect(registry.resolve(source)).resolves.toBe(highConfidence);
  });

  it("throws FORMAT_ENGINE_NOT_FOUND when every confidence is zero", async () => {
    const registry = new PublicationEngineRegistry([fakeEngine(0), fakeEngine(0)]);

    try {
      await registry.resolve(source);
      expect.fail("resolve should reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ScopeException);
      expect((error as ScopeException).issues[0]?.code).toBe("FORMAT_ENGINE_NOT_FOUND");
    }
  });
});
