import type { PublicationSource } from "../domain/publication";
import { issue, ScopeException } from "../domain/scopeError";
import type { PublicationEngine } from "./PublicationEngine";

export class PublicationEngineRegistry {
  constructor(private readonly engines: readonly PublicationEngine[]) {}

  async resolve(source: PublicationSource): Promise<PublicationEngine> {
    const confidences = await Promise.all(this.engines.map((engine) => engine.canOpen(source)));
    let selected: PublicationEngine | undefined;
    let highestConfidence = 0;

    for (const [index, confidence] of confidences.entries()) {
      if (confidence > highestConfidence) {
        highestConfidence = confidence;
        selected = this.engines[index];
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
