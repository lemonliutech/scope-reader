import ePub from "epubjs";
import type { EpubBook, EpubNavItem, EpubSection } from "epubjs";
import { issue, ScopeException } from "../../domain/scopeError";

export type EpubDriverNavNode = { id: string; label: string; href: string; children: EpubDriverNavNode[] };
export type EpubDriverSpineItem = { id: string; href: string; linear: boolean };
export type EpubDriverInspection = {
  metadata: { title: string; creator: string; language?: string; description?: string };
  navigation: EpubDriverNavNode[];
  spine: EpubDriverSpineItem[];
  cover: Blob | null;
};
export type EpubDriverChapter = { href: string; html: string; objectUrls: string[] };

export class EpubJsDriver {
  private book: EpubBook | null = null;

  private readonly objectUrls = new Set<string>();

  async inspect(data: ArrayBuffer): Promise<EpubDriverInspection> {
    const temporaryBook = this.createBook(data);
    try {
      await this.waitUntilReady(temporaryBook);
      return await this.readInspection(temporaryBook);
    } finally {
      await this.releaseBook(temporaryBook);
    }
  }

  async open(data: ArrayBuffer): Promise<void> {
    await this.destroy();
    const book = this.createBook(data);
    try {
      await this.waitUntilReady(book);
      this.book = book;
    } catch (error) {
      await this.releaseBook(book);
      throw this.mapDriverError(error, "PREPARE_PUBLICATION");
    }
  }

  async loadChapter(href: string): Promise<EpubDriverChapter> {
    if (this.book === null) {
      throw new ScopeException([issue("ENGINE_LOAD_FAILED", "LOAD_CHAPTER", true)]);
    }

    try {
      const section = this.resolveSection(this.book, href);
      const html = await section.render(this.book.load.bind(this.book));
      const objectUrls = extractObjectUrls(html);
      objectUrls.forEach((url) => this.objectUrls.add(url));

      return {
        href: normalizeHref(section.href),
        html,
        objectUrls,
      };
    } catch (error) {
      throw this.mapDriverError(error, "LOAD_CHAPTER");
    }
  }

  async destroy(): Promise<void> {
    const book = this.book;
    this.book = null;
    await this.releaseBook(book);
  }

  private createBook(data: ArrayBuffer): EpubBook {
    ensureWindowUrlApis();
    return ePub(data.slice(0), { replacements: "blobUrl" });
  }

  private async waitUntilReady(book: EpubBook): Promise<void> {
    await book.loaded.metadata;
    await book.loaded.navigation;
    await book.loaded.spine;
    await book.ready;
  }

  private async readInspection(book: EpubBook): Promise<EpubDriverInspection> {
    const [metadata, navigation] = await Promise.all([book.loaded.metadata, book.loaded.navigation]);
    const cover = await this.readCover(book);

    return {
      metadata: {
        title: metadata.title?.trim() ?? "",
        creator: metadata.creator?.trim() ?? "",
        ...(metadata.language?.trim() ? { language: metadata.language.trim() } : {}),
        ...(metadata.description?.trim() ? { description: metadata.description.trim() } : {}),
      },
      navigation: navigation.toc.map(cloneNavigationNode),
      spine: book.spine.spineItems.map((item) => ({
        id: item.idref,
        href: normalizeHref(item.href),
        linear: item.linear,
      })),
      cover,
    };
  }

  private async readCover(book: EpubBook): Promise<Blob | null> {
    const coverUrl = await book.coverUrl();
    if (coverUrl === null) return null;

    this.objectUrls.add(coverUrl);
    const response = await fetch(coverUrl);
    return await response.blob();
  }

  private resolveSection(book: EpubBook, href: string): EpubSection {
    const section = book.spine.get(href);
    if (section === null) {
      throw new ScopeException([
        issue("RESOURCE_MISSING", "LOAD_CHAPTER", true, { href: normalizeHref(href) }),
      ]);
    }
    return section;
  }

  private async releaseBook(book: EpubBook | null): Promise<void> {
    const revokeResults = await Promise.allSettled(
      Array.from(this.objectUrls, (url) =>
        Promise.resolve().then(() => {
          URL.revokeObjectURL(url);
        })
      ),
    );
    this.objectUrls.clear();
    const destroyResults = await Promise.allSettled([
      Promise.resolve().then(() => {
        book?.destroy();
      }),
    ]);
    const failures = [...revokeResults, ...destroyResults].filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failures.length > 0) {
      throw new ScopeException([
        issue("ENGINE_DISPOSE_FAILED", "DISPOSE_SESSION", false, {
          failures: failures.map(({ reason }) => String(reason)),
        }),
      ]);
    }
  }

  private mapDriverError(error: unknown, stage: "PREPARE_PUBLICATION" | "LOAD_CHAPTER"): ScopeException {
    if (error instanceof ScopeException) return error;
    return new ScopeException([
      issue(stage === "LOAD_CHAPTER" ? "RESOURCE_DECODE_FAILED" : "ENGINE_LOAD_FAILED", stage, true, {
        reason: error instanceof Error ? error.message : String(error),
      }),
    ]);
  }
}

function cloneNavigationNode(node: EpubNavItem): EpubDriverNavNode {
  return {
    id: node.id ?? node.href,
    label: node.label,
    href: node.href,
    children: node.subitems.map(cloneNavigationNode),
  };
}

function normalizeHref(href: string): string {
  return href.split("#")[0] ?? href;
}

function extractObjectUrls(html: string): string[] {
  return Array.from(new Set(html.match(/blob:[^"'\\s)]+/g) ?? []));
}

function ensureWindowUrlApis(): void {
  if (typeof window === "undefined" || window.URL === undefined) return;

  if (typeof window.URL.createObjectURL !== "function" && typeof globalThis.URL.createObjectURL === "function") {
    window.URL.createObjectURL = globalThis.URL.createObjectURL.bind(globalThis.URL);
  }

  if (typeof window.URL.revokeObjectURL !== "function" && typeof globalThis.URL.revokeObjectURL === "function") {
    window.URL.revokeObjectURL = globalThis.URL.revokeObjectURL.bind(globalThis.URL);
  }
}
