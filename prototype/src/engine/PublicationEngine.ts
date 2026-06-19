import type {
  ChapterDocument,
  FormatConfidence,
  PublicationFormat,
  PublicationInspection,
  PublicationLocation,
  PublicationSource,
  PublicationTarget,
} from "../domain/publication";

export interface PublicationSession {
  getInspection(): PublicationInspection;
  loadChapter(target: PublicationTarget): Promise<ChapterDocument>;
  getLocation(): PublicationLocation;
  destroy(): Promise<void>;
}

export interface PublicationEngine {
  readonly format: PublicationFormat;
  canOpen(source: PublicationSource): Promise<FormatConfidence>;
  inspect(source: PublicationSource): Promise<PublicationInspection>;
  open(source: PublicationSource): Promise<PublicationSession>;
}
