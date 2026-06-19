import type {
  BookMetadata,
  ChapterDocument,
  NavigationNode,
  PublicationInspection,
  PublicationLocation,
  PublicationSource,
  PublicationTarget,
  ReadingOrderItem,
} from "../../domain/publication";
import {
  blockingIssues,
  issue,
  ScopeException,
  type ScopeIssue,
  type ScopeErrorCode,
} from "../../domain/scopeError";
import type { PublicationEngine, PublicationSession } from "../PublicationEngine";
import {
  EpubJsDriver,
  type EpubDriverInspection,
  type EpubDriverNavNode,
  type EpubDriverSpineItem,
} from "./EpubJsDriver";
import { preflightEpub } from "./epubPreflight";

const EPUB_CONTAINER_CODES: ReadonlySet<ScopeErrorCode> = new Set([
  "ZIP_INVALID",
  "ZIP_BOMB_SUSPECTED",
  "MIMETYPE_MISSING",
  "MIMETYPE_INVALID",
  "CONTAINER_XML_MISSING",
  "CONTAINER_XML_INVALID",
] as const);

const EPUB_DRIVER_FATAL_CODES: ReadonlySet<ScopeErrorCode> = new Set([
  "ZIP_INVALID",
  "ZIP_BOMB_SUSPECTED",
  "MIMETYPE_MISSING",
  "MIMETYPE_INVALID",
  "CONTAINER_XML_MISSING",
  "CONTAINER_XML_INVALID",
  "PACKAGE_DOCUMENT_MISSING",
  "PACKAGE_DOCUMENT_INVALID",
  "MANIFEST_INVALID",
  "SPINE_EMPTY",
  "SPINE_REFERENCE_MISSING",
] as const);

export class EpubEngineAdapter implements PublicationEngine {
  readonly format = "EPUB" as const;

  constructor(private readonly driverFactory: () => EpubJsDriver) {}

  async canOpen(source: PublicationSource) {
    const bytes = new Uint8Array(source.data);
    const preflight = preflightEpub(bytes);
    const codes = preflight.issues.map((i) => i.code);
    const hasContainerIssue = preflight.issues.some((item) => EPUB_CONTAINER_CODES.has(item.code));
    const hasEpub = hasEpubExtension(source.fileName);
    const confidence = !hasContainerIssue ? 100 : hasEpub ? 20 : 0;
    console.error("[EpubEngineAdapter.canOpen]", {
      fileName: source.fileName, byteLength: bytes.byteLength,
      issues: codes, hasContainerIssue, hasEpub, confidence,
    });
    return confidence;
  }

  async inspect(source: PublicationSource): Promise<PublicationInspection> {
    const preflight = preflightEpub(new Uint8Array(source.data));
    const driverInspection = await this.loadDriverInspection(source, preflight.issues);
    return normalizeInspection(source, driverInspection, preflight.issues);
  }

  async open(source: PublicationSource): Promise<PublicationSession> {
    const preflight = preflightEpub(new Uint8Array(source.data));
    const blocking = blockingIssues(preflight.issues);
    if (blocking.length > 0) {
      throw new ScopeException(blocking);
    }

    const driver = this.driverFactory();
    try {
      const driverInspection = await this.loadDriverInspection(source, preflight.issues, driver);
      await driver.open(source.data);
      const inspection = normalizeInspection(source, driverInspection, preflight.issues);
      return new EpubPublicationSession(driver, inspection);
    } catch (error) {
      await destroyQuietly(driver);
      throw mapAdapterError(error, "PREPARE_PUBLICATION");
    }
  }

  private async loadDriverInspection(
    source: PublicationSource,
    issues: readonly ScopeIssue[],
    sharedDriver?: EpubJsDriver,
  ): Promise<EpubDriverInspection | null> {
    if (issues.some((item) => EPUB_DRIVER_FATAL_CODES.has(item.code))) return null;

    const driver = sharedDriver ?? this.driverFactory();
    try {
      return await driver.inspect(source.data);
    } catch (error) {
      throw mapAdapterError(error, "INSPECT_PUBLICATION");
    } finally {
      if (sharedDriver === undefined) {
        await destroyQuietly(driver);
      }
    }
  }
}

class EpubPublicationSession implements PublicationSession {
  private location: PublicationLocation;

  constructor(
    private readonly driver: EpubJsDriver,
    private readonly inspection: PublicationInspection,
  ) {
    const firstTarget = inspection.readingOrder[0]?.target;
    this.location = {
      format: "EPUB",
      locator: firstTarget?.locator ?? "",
      chapterIndex: firstTarget ? 0 : -1,
      scrollRatio: 0,
    };
  }

  getInspection(): PublicationInspection {
    return this.inspection;
  }

  async loadChapter(target: PublicationTarget): Promise<ChapterDocument> {
    if (target.format !== "EPUB") {
      throw new ScopeException([issue("LOCATION_INVALID", "LOAD_CHAPTER", true, { target })]);
    }

    const chapter = await this.driver.loadChapter(target.locator);
    const chapterHref = normalizeLocator(target.locator);
    const chapterIndex = this.inspection.readingOrder.findIndex((item) => item.target.locator === chapterHref);
    const warnings = collectAnchorWarnings(target.locator, chapter.html);

    this.location = {
      format: "EPUB",
      locator: target.locator,
      chapterIndex,
      scrollRatio: 0,
    };

    return {
      id: chapterHref,
      title: findChapterTitle(this.inspection, target.locator),
      html: chapter.html,
      baseUrl: chapter.href,
      warnings,
    };
  }

  getLocation(): PublicationLocation {
    return this.location;
  }

  async destroy(): Promise<void> {
    await this.driver.destroy();
  }
}

function normalizeInspection(
  source: PublicationSource,
  driverInspection: EpubDriverInspection | null,
  preflightIssues: readonly ScopeIssue[],
): PublicationInspection {
  const metadata = normalizeMetadata(source, driverInspection?.metadata);
  const readingOrder = normalizeReadingOrder(driverInspection?.spine ?? [], driverInspection?.navigation ?? []);
  const issues = [...preflightIssues];
  const navigation = normalizeNavigation(driverInspection?.navigation ?? [], readingOrder, issues);

  return {
    metadata: {
      ...metadata,
      cover: driverInspection?.cover ?? null,
    },
    navigation,
    readingOrder,
    issues,
  };
}

function normalizeMetadata(
  source: PublicationSource,
  metadata?: EpubDriverInspection["metadata"],
): Omit<BookMetadata, "cover"> {
  const fallbackTitle = source.fileName.replace(/\.epub$/iu, "") || "未命名图书";
  const title = metadata?.title?.trim() || fallbackTitle;
  const creator = metadata?.creator?.trim();

  return {
    title,
    authors: creator ? [creator] : [],
    language: metadata?.language?.trim() || null,
    description: metadata?.description?.trim() || null,
  };
}

function normalizeNavigation(
  nodes: readonly EpubDriverNavNode[],
  readingOrder: readonly ReadingOrderItem[],
  issues: ScopeIssue[],
): NavigationNode[] {
  if (nodes.length > 0) {
    return nodes.map((node, index) => mapNavigationNode(node, "root", index));
  }

  if (readingOrder.length === 0) return [];

  issues.push(issue("NAVIGATION_INVALID", "INSPECT_PUBLICATION", false, { reason: "AUTO_GENERATED" }));
  return readingOrder.map((item, index) => ({
    id: `root:${index}:${item.target.locator}`,
    label: item.label,
    target: item.target,
    children: [],
  }));
}

function mapNavigationNode(node: EpubDriverNavNode, parentId: string, index: number): NavigationNode {
  const target = {
    format: "EPUB" as const,
    locator: node.href,
  };
  const id = `${parentId}:${index}:${node.href}`;
  return {
    id,
    label: node.label.trim() || normalizeLocator(node.href),
    target,
    children: node.children.map((child, childIndex) => mapNavigationNode(child, id, childIndex)),
  };
}

function normalizeReadingOrder(
  spine: readonly EpubDriverSpineItem[],
  navigation: readonly EpubDriverNavNode[],
): ReadingOrderItem[] {
  const labels = new Map<string, string>();
  flattenNavigation(navigation).forEach((node) => {
    labels.set(normalizeLocator(node.href), node.label.trim() || normalizeLocator(node.href));
  });

  return spine.map((item) => ({
    id: item.id,
    label: labels.get(item.href) ?? item.href,
    target: { format: "EPUB", locator: item.href },
    linear: item.linear,
  }));
}

function flattenNavigation(nodes: readonly EpubDriverNavNode[]): EpubDriverNavNode[] {
  return nodes.flatMap((node) => [node, ...flattenNavigation(node.children)]);
}

function collectAnchorWarnings(locator: string, html: string): ScopeIssue[] {
  const fragment = locator.split("#")[1];
  if (fragment === undefined || fragment === "") return [];

  const document = new DOMParser().parseFromString(html, "application/xhtml+xml");
  if (
    document.getElementById(fragment) !== null ||
    document.querySelector(`[name="${cssEscape(fragment)}"]`) !== null
  ) {
    return [];
  }

  return [issue("ANCHOR_NOT_FOUND", "LOAD_CHAPTER", false, { locator })];
}

function findChapterTitle(inspection: PublicationInspection, locator: string): string {
  const normalizedLocator = normalizeLocator(locator);
  const navigationLabel = findNavigationLabel(inspection.navigation, locator)
    ?? findNavigationLabel(inspection.navigation, normalizedLocator);
  if (navigationLabel) return navigationLabel;
  return inspection.readingOrder.find((item) => item.target.locator === normalizedLocator)?.label ?? normalizedLocator;
}

function findNavigationLabel(nodes: readonly NavigationNode[], locator: string): string | null {
  for (const node of nodes) {
    if (node.target.locator === locator) return node.label;
    const child = findNavigationLabel(node.children, locator);
    if (child !== null) return child;
  }
  return null;
}

function normalizeLocator(locator: string): string {
  return locator.split("#")[0] ?? locator;
}

function hasEpubExtension(fileName: string): boolean {
  return /\.epub$/iu.test(fileName);
}

function cssEscape(value: string): string {
  return value.replaceAll('"', '\\"');
}

async function destroyQuietly(driver: EpubJsDriver): Promise<void> {
  try {
    await driver.destroy();
  } catch {
    // Cleanup failures should not replace the primary import error.
  }
}

function mapAdapterError(
  error: unknown,
  stage: "INSPECT_PUBLICATION" | "PREPARE_PUBLICATION",
): ScopeException {
  if (error instanceof ScopeException) return error;
  return new ScopeException([
    issue("ENGINE_LOAD_FAILED", stage, true, {
      reason: error instanceof Error ? error.message : String(error),
    }),
  ]);
}
