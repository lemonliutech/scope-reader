import type { PublicationSource } from "../domain/publication";
import { issue, ScopeException } from "../domain/scopeError";
import type { PublicationEngine } from "./PublicationEngine";

export class PublicationEngineRegistry {
  constructor(private readonly engines: readonly PublicationEngine[]) {}

  async select(source: PublicationSource): Promise<PublicationEngine> {
    console.error("[Registry.select] engines:", this.engines.length, "fileName:", source.fileName);
    const results = await Promise.all(this.engines.map(async (engine) => {
      try {
        return { engine, confidence: await engine.canOpen(source), failed: false as const };
      } catch {
        return { engine, failed: true as const };
      }
    }));
    const failureCount = results.filter(({ failed }) => failed).length;

    if (failureCount > 0 && failureCount === this.engines.length) {
      throw new ScopeException([
        issue("ENGINE_LOAD_FAILED", "DETECT_FORMAT", true, { failureCount }),
      ]);
    }

    let selected: PublicationEngine | undefined;
    let highestConfidence = 0;

    for (const result of results) {
      if (!result.failed && result.confidence > highestConfidence) {
        highestConfidence = result.confidence;
        selected = result.engine;
      }
    }

    if (!selected || highestConfidence === 0) {
      throw new ScopeException([
        issue("FORMAT_ENGINE_NOT_FOUND", "DETECT_FORMAT", true),
      ]);
    }

    return selected;
  }
}
