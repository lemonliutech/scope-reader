import type { ChapterDocument, PublicationInspection, PublicationLocation, PublicationSource, PublicationTarget } from "../domain/publication";
import {
  blockingIssues,
  issue,
  ScopeException,
  type ImportStage,
  type ScopeIssue,
} from "../domain/scopeError";
import { PublicationEngineRegistry } from "../engine/PublicationEngineRegistry";
import type { PublicationEngine, PublicationSession } from "../engine/PublicationEngine";
import type { LibraryRepository, StoredReadingState } from "../storage/schema";

export type ImportProgress = { stage: ImportStage; label: string };

export type ImportResult = {
  bookId: string | null;
  inspection: PublicationInspection | null;
  issues: ScopeIssue[];
  temporary: boolean;
};

export type OpenedPublication = {
  bookId: string;
  inspection: PublicationInspection;
  location: PublicationLocation;
  temporary: boolean;
};

const STAGE_LABELS: Record<ImportStage, string> = {
  READ_FILE: "读取文件",
  DETECT_FORMAT: "识别格式",
  INSPECT_PUBLICATION: "解析出版物",
  CHECK_CAPABILITIES: "检查兼容性",
  PREPARE_PUBLICATION: "准备引擎",
  PERSIST_PUBLICATION: "保存到书库",
  OPEN_READER: "打开阅读器",
};

export class ReaderService {
  private session: PublicationSession | null = null;
  private sessionBookId: string | null = null;
  private temporarySource: ArrayBuffer | null = null;

  constructor(
    private readonly registry: PublicationEngineRegistry,
    private readonly repository: LibraryRepository,
  ) {}

  async importFile(
    file: File,
    onProgress: (progress: ImportProgress) => void,
  ): Promise<ImportResult> {
    const disposeIssues = await this.destroyCurrentSession();

    const report = (stage: ImportStage) => onProgress({ stage, label: STAGE_LABELS[stage] });

    // READ_FILE
    report("READ_FILE");
    let data: ArrayBuffer;
    try {
      data = await file.arrayBuffer();
    } catch (error) {
      return result(null, null, [
        issue("FILE_READ_DENIED", "READ_FILE", true, { reason: String(error) }),
        ...disposeIssues,
      ]);
    }

    const source = { fileName: file.name, mediaType: file.type, size: file.size, data };

    // DETECT_FORMAT
    report("DETECT_FORMAT");
    let engine;
    try {
      engine = await this.registry.select(source);
    } catch (error) {
      return result(null, null, [
        ...scopeIssues(error, "FORMAT_ENGINE_NOT_FOUND", "DETECT_FORMAT"),
        ...disposeIssues,
      ]);
    }

    // INSPECT_PUBLICATION
    report("INSPECT_PUBLICATION");
    let inspection: PublicationInspection;
    try {
      inspection = await engine.inspect(source);
    } catch (error) {
      return result(null, null, [
        ...scopeIssues(error, "ENGINE_LOAD_FAILED", "INSPECT_PUBLICATION"),
        ...disposeIssues,
      ]);
    }

    // CHECK_CAPABILITIES
    report("CHECK_CAPABILITIES");
    const blocking = blockingIssues(inspection.issues);
    if (blocking.length > 0) {
      return result(null, inspection, [...inspection.issues, ...disposeIssues]);
    }

    // PREPARE_PUBLICATION
    report("PREPARE_PUBLICATION");
    let session: PublicationSession;
    try {
      session = await engine.open(source);
    } catch (error) {
      return result(null, inspection, [
        ...inspection.issues,
        ...scopeIssues(error, "ENGINE_LOAD_FAILED", "PREPARE_PUBLICATION"),
        ...disposeIssues,
      ]);
    }

    // Compute SHA-256 for dedup
    const sha256 = await toHex(await crypto.subtle.digest("SHA-256", data));
    const bookId = `epub-${sha256.slice(0, 16)}`;

    // PERSIST_PUBLICATION
    report("PERSIST_PUBLICATION");
    let temporary = false;
    const importedAt = new Date().toISOString();
    const location = session.getLocation();

    try {
      await this.repository.importBook({
        book: {
          bookId,
          sha256,
          blob: data,
          fileName: file.name,
          size: file.size,
          importedAt,
          lastOpenedAt: importedAt,
        },
        publication: {
          bookId,
          format: "EPUB",
          engineVersion: "0.3.93",
          inspection,
        },
        readingState: {
          bookId,
          location,
          updatedAt: importedAt,
        },
      });
    } catch (error) {
      // IndexedDB unavailable → keep session in memory, mark temporary
      if (
        error instanceof ScopeException &&
        error.issues.some((i) => i.code === "INDEXEDDB_UNAVAILABLE")
      ) {
        temporary = true;
        this.temporarySource = data;
      } else {
        await session.destroy().catch(() => {});
        return result(null, inspection, [
          ...inspection.issues,
          ...scopeIssues(error, "BOOK_PERSIST_FAILED", "PERSIST_PUBLICATION"),
          ...disposeIssues,
        ]);
      }
    }

    // OPEN_READER
    report("OPEN_READER");
    this.session = session;
    this.sessionBookId = bookId;

    return result(bookId, inspection, [...inspection.issues, ...disposeIssues], temporary);
  }

  async openBook(bookId: string): Promise<OpenedPublication> {
    // Reuse the in-memory session without destroying it
    if (this.sessionBookId === bookId && this.session !== null) {
      return {
        bookId,
        inspection: this.session.getInspection(),
        location: this.session.getLocation(),
        temporary: this.temporarySource !== null,
      };
    }

    const disposeIssues = await this.destroyCurrentSession();

    // Load persisted book from storage
    let bundle: Awaited<ReturnType<typeof this.repository.loadBook>>;
    try {
      bundle = await this.repository.loadBook(bookId);
    } catch {
      throw new ScopeException([
        ...disposeIssues,
        issue("ENGINE_LOAD_FAILED", "OPEN_READER", true),
      ]);
    }

    if (!bundle) {
      throw new ScopeException([
        ...disposeIssues,
        issue("ENGINE_LOAD_FAILED", "OPEN_READER", true),
      ]);
    }

    const data = bundle.book.blob;
    const source: PublicationSource = {
      fileName: bundle.book.fileName,
      mediaType: "application/epub+zip",
      size: bundle.book.size,
      data,
    };

    let engine: PublicationEngine;
    try {
      engine = await this.registry.select(source);
    } catch (error) {
      throw new ScopeException([
        ...disposeIssues,
        ...scopeIssues(error, "FORMAT_ENGINE_NOT_FOUND", "OPEN_READER"),
      ]);
    }

    let session: PublicationSession;
    try {
      session = await engine.open(source);
    } catch (error) {
      throw new ScopeException([
        ...disposeIssues,
        ...scopeIssues(error, "ENGINE_LOAD_FAILED", "OPEN_READER"),
      ]);
    }

    this.session = session;
    this.sessionBookId = bookId;

    return {
      bookId,
      inspection: bundle.publication.inspection,
      location: bundle.readingState.location,
      temporary: false,
    };
  }

  async loadChapter(target: PublicationTarget): Promise<ChapterDocument> {
    if (this.session === null) {
      throw new ScopeException([issue("ENGINE_LOAD_FAILED", "LOAD_CHAPTER", true)]);
    }
    return this.session.loadChapter(target);
  }

  getLocation(): PublicationLocation | null {
    return this.session?.getLocation() ?? null;
  }

  async saveLocation(location: PublicationLocation): Promise<void> {
    if (this.sessionBookId === null || this.temporarySource !== null) return;
    const state: StoredReadingState = {
      bookId: this.sessionBookId,
      location,
      updatedAt: new Date().toISOString(),
    };
    await this.repository.saveReadingState(state).catch(() => {});
  }

  async close(): Promise<ScopeIssue[]> {
    return this.destroyCurrentSession();
  }

  private async destroyCurrentSession(): Promise<ScopeIssue[]> {
    const session = this.session;
    this.session = null;
    this.sessionBookId = null;
    this.temporarySource = null;
    if (session === null) return [];
    try {
      await session.destroy();
      return [];
    } catch (error) {
      return [
        issue("ENGINE_DISPOSE_FAILED", "DISPOSE_SESSION", false, {
          reason: error instanceof Error ? error.message : String(error),
        }),
      ];
    }
  }
}

function result(
  bookId: string | null,
  inspection: PublicationInspection | null,
  issues: ScopeIssue[],
  temporary = false,
): ImportResult {
  return { bookId, inspection, issues, temporary };
}

function scopeIssues(
  error: unknown,
  fallback: Parameters<typeof issue>[0],
  stage: Parameters<typeof issue>[1],
): ScopeIssue[] {
  if (error instanceof ScopeException) return error.issues;
  return [issue(fallback, stage, true, { reason: String(error) })];
}

async function toHex(buffer: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
