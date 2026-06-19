import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChapterDocument, NavigationNode, PublicationInspection, PublicationLocation, PublicationTarget } from "../domain/publication";
import type { ScopeIssue } from "../domain/scopeError";
import { EpubEngineAdapter } from "../engine/epub/EpubEngineAdapter";
import { EpubJsDriver } from "../engine/epub/EpubJsDriver";
import { PublicationEngineRegistry } from "../engine/PublicationEngineRegistry";
import { IndexedDbLibraryRepository } from "../storage/IndexedDbLibraryRepository";
import type { LibraryBook } from "../storage/schema";
import { ReaderService, type ImportProgress } from "./ReaderService";

type IdleState = { status: "idle" };
type ImportingState = { status: "importing"; progress: ImportProgress | null };
type ReadyState = {
  status: "ready";
  bookId: string;
  inspection: PublicationInspection;
  location: PublicationLocation;
  chapter: ChapterDocument | null;
  temporary: boolean;
};
type ErrorState = { status: "error"; issues: ScopeIssue[] };

type ControllerState = IdleState | ImportingState | ReadyState | ErrorState;

export type ReaderController = {
  state: ControllerState;
  books: LibraryBook[];
  issues: ScopeIssue[];
  navigation: NavigationNode[];
  importFile: (file: File) => Promise<boolean>;
  openBook: (bookId: string) => Promise<void>;
  openTarget: (target: PublicationTarget) => Promise<void>;
  deleteBook: (bookId: string) => Promise<void>;
};

export function useReaderController(): ReaderController {
  const repoRef = useRef(new IndexedDbLibraryRepository());
  const serviceRef = useRef(
    new ReaderService(
      new PublicationEngineRegistry([new EpubEngineAdapter(() => new EpubJsDriver())]),
      repoRef.current,
    ),
  );

  const [controllerState, setControllerState] = useState<ControllerState>({ status: "idle" });
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [issues, setIssues] = useState<ScopeIssue[]>([]);

  // Load library on mount
  useEffect(() => {
    repoRef.current.listBooks().then(setBooks).catch(() => {});
    return () => {
      serviceRef.current.close().catch(() => {});
    };
  }, []);

  const refreshBooks = useCallback(async () => {
    try {
      const list = await repoRef.current.listBooks();
      setBooks(list);
    } catch {
      // Non-fatal: library UI will show stale list
    }
  }, []);

  const importFile = useCallback(async (file: File): Promise<boolean> => {
    setControllerState({ status: "importing", progress: null });
    setIssues([]);

    const result = await serviceRef.current.importFile(file, (progress) => {
      setControllerState({ status: "importing", progress });
    });

    setIssues(result.issues);

    if (result.bookId === null || result.inspection === null) {
      setControllerState({ status: "error", issues: result.issues });
      return false;
    }

    const firstTarget = result.inspection.readingOrder[0]?.target;
    const location: PublicationLocation = {
      format: "EPUB",
      locator: firstTarget?.locator ?? "",
      chapterIndex: 0,
      scrollRatio: 0,
    };

    let firstChapter: ChapterDocument | null = null;
    if (firstTarget) {
      try { firstChapter = await serviceRef.current.loadChapter(firstTarget); } catch { /* show placeholder */ }
    }

    setControllerState({
      status: "ready",
      bookId: result.bookId,
      inspection: result.inspection,
      location,
      chapter: firstChapter,
      temporary: result.temporary,
    });

    if (!result.temporary) await refreshBooks();
    return true;
  }, [refreshBooks]);

  const openBook = useCallback(async (bookId: string) => {
    setIssues([]);
    try {
      const pub = await serviceRef.current.openBook(bookId);

      // Restore the saved chapter; fall back to the first chapter on failure
      const restoreLocator = pub.location.locator || pub.inspection.readingOrder[0]?.target.locator;
      const restoreTarget = restoreLocator ? { format: "EPUB" as const, locator: restoreLocator } : null;
      let restoredChapter: ChapterDocument | null = null;
      if (restoreTarget) {
        try {
          restoredChapter = await serviceRef.current.loadChapter(restoreTarget);
        } catch {
          const firstTarget = pub.inspection.readingOrder[0]?.target;
          if (firstTarget && firstTarget.locator !== restoreLocator) {
            try { restoredChapter = await serviceRef.current.loadChapter(firstTarget); } catch {}
          }
        }
      }

      setControllerState({
        status: "ready",
        bookId: pub.bookId,
        inspection: pub.inspection,
        location: serviceRef.current.getLocation() ?? pub.location,
        chapter: restoredChapter,
        temporary: pub.temporary,
      });
    } catch {
      setControllerState({ status: "idle" });
    }
  }, []);

  const openTarget = useCallback(async (target: PublicationTarget) => {
    const chapter = await serviceRef.current.loadChapter(target);
    // Session updates its internal location after loadChapter (with correct chapterIndex)
    const location = serviceRef.current.getLocation() ?? {
      format: target.format,
      locator: target.locator,
      chapterIndex: 0,
      scrollRatio: 0,
    };
    await serviceRef.current.saveLocation(location);

    setControllerState((prev) => {
      if (prev.status !== "ready") return prev;
      return { ...prev, chapter, location };
    });
  }, []);

  const deleteBook = useCallback(async (bookId: string) => {
    await repoRef.current.deleteBook(bookId);
    setControllerState((prev) => {
      if (prev.status === "ready" && prev.bookId === bookId) return { status: "idle" };
      return prev;
    });
    await refreshBooks();
  }, [refreshBooks]);

  const navigation = useMemo(() => {
    if (controllerState.status !== "ready") return [];
    return controllerState.inspection.navigation;
  }, [controllerState]);

  return { state: controllerState, books, issues, navigation, importFile, openBook, openTarget, deleteBook };
}
