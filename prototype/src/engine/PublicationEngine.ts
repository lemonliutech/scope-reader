import type {
  ChapterDocument,
  FormatConfidence,
  PublicationFormat,
  PublicationInspection,
  PublicationLocation,
  PublicationSource,
} from "../domain/publication";

export interface PublicationSession {
  getInspection(): PublicationInspection;
  loadChapter(chapterId: string): Promise<ChapterDocument>;
  getLocation(): PublicationLocation;
  destroy(): Promise<void>;
}

export interface PublicationEngine {
  readonly format: PublicationFormat;
  canOpen(source: PublicationSource): Promise<FormatConfidence>;
  inspect(source: PublicationSource): Promise<PublicationInspection>;
  open(source: PublicationSource, location?: PublicationLocation): Promise<PublicationSession>;
}
