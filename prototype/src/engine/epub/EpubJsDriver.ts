/**
 * EPUB parsing driver — replaces epubjs with a self-contained implementation.
 *
 * Responsibilities:
 *   inspect()     → parse metadata, spine, navigation from the ZIP
 *   open()        → keep ZIP in memory, build resource-URL cache
 *   loadChapter() → render spine item to HTML with inlined blob: URLs
 *   destroy()     → revoke all blob: URLs and free memory
 *
 * Dependencies: fflate (ZIP decode), DOMParser (available in browser + jsdom)
 */

import { unzipSync } from "fflate";
import { issue, ScopeException } from "../../domain/scopeError";

// ── Public types (unchanged contract with EpubEngineAdapter) ──────────────────

export type EpubDriverNavNode = { id: string; label: string; href: string; children: EpubDriverNavNode[] };
export type EpubDriverSpineItem = { id: string; href: string; linear: boolean };
export type EpubDriverInspection = {
  metadata: { title: string; creator: string; language?: string; description?: string };
  navigation: EpubDriverNavNode[];
  spine: EpubDriverSpineItem[];
  cover: Blob | null;
};
export type EpubDriverChapter = { href: string; html: string; objectUrls: string[] };

// ── Driver ────────────────────────────────────────────────────────────────────

export class EpubJsDriver {
  /** All blob: URLs created during the open session — revoked on destroy() */
  private readonly objectUrls = new Set<string>();
  /** path → raw file bytes (populated after open()) */
  private files: Record<string, Uint8Array> = {};
  /** path → blob: URL (lazy cache) */
  private readonly blobCache = new Map<string, string>();
  /** OPF package directory prefix, e.g. "OEBPS/" */
  private opfDir = "";
  private opened = false;

  // ── Public API ─────────────────────────────────────────────────────────────

  async inspect(data: ArrayBuffer): Promise<EpubDriverInspection> {
    const files = unzipEpub(data);
    const { opfPath, opfDir } = findOpf(files);
    const opfDoc = parseXml(files, opfPath);
    return buildInspection(opfDoc, opfDir, files);
  }

  async open(data: ArrayBuffer): Promise<void> {
    await this.destroy();
    this.files = unzipEpub(data);
    const { opfDir } = findOpf(this.files);
    this.opfDir = opfDir;
    this.opened = true;
  }

  async loadChapter(href: string): Promise<EpubDriverChapter> {
    if (!this.opened) {
      throw new ScopeException([issue("ENGINE_LOAD_FAILED", "LOAD_CHAPTER", true)]);
    }

    // Strip fragment for file lookup
    const [filePath] = href.split("#");
    const resolved = resolveHref(this.opfDir, filePath ?? href);

    const raw = this.files[resolved] ?? this.files[resolved.replace(/^\//, "")];
    if (!raw) {
      throw new ScopeException([
        issue("RESOURCE_MISSING", "LOAD_CHAPTER", true, { href: resolved }),
      ]);
    }

    const inputPath = filePath ?? href;
    const htmlText = new TextDecoder().decode(raw);
    const doc = new DOMParser().parseFromString(htmlText, "application/xhtml+xml");
    if (doc.querySelector("parsererror")) {
      const fallback = new DOMParser().parseFromString(htmlText, "text/html");
      await this.rewriteResourceUrls(fallback, resolved);
      return { href: inputPath, html: serialiseDoc(fallback), objectUrls: [] };
    }

    await this.rewriteResourceUrls(doc, resolved);
    return { href: inputPath, html: serialiseDoc(doc), objectUrls: [] };
  }

  async destroy(): Promise<void> {
    this.opened = false;
    this.files = {};
    this.opfDir = "";
    for (const url of this.objectUrls) URL.revokeObjectURL(url);
    this.objectUrls.clear();
    this.blobCache.clear();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private blobUrl(path: string, mediaType: string): string {
    const cached = this.blobCache.get(path);
    if (cached) return cached;
    const bytes = this.files[path] ?? this.files[path.replace(/^\//, "")];
    if (!bytes) return "";
    const url = URL.createObjectURL(new Blob([toArrayBuffer(bytes)], { type: mediaType }));
    this.objectUrls.add(url);
    this.blobCache.set(path, url);
    return url;
  }

  /** Replace all local resource URLs (src/href/xlink:href) with blob: URLs */
  private async rewriteResourceUrls(doc: Document, chapterPath: string): Promise<void> {
    const chapterDir = chapterPath.substring(0, chapterPath.lastIndexOf("/") + 1);

    const rewrite = (el: Element, attr: string) => {
      const raw = el.getAttribute(attr);
      if (!raw || raw.startsWith("http") || raw.startsWith("//") || raw.startsWith("data:") || raw.startsWith("#")) return;
      const [filePart, fragment] = raw.split("#");
      const abs = resolveHref(chapterDir, filePart ?? raw);
      const mt = guessMimeType(abs);
      const url = this.blobUrl(abs, mt);
      if (url) el.setAttribute(attr, fragment ? `${url}#${fragment}` : url);
    };

    for (const el of Array.from(doc.querySelectorAll("img,image,audio,video,source"))) {
      rewrite(el, "src");
      rewrite(el, "xlink:href");
    }
    for (const el of Array.from(doc.querySelectorAll("link[rel='stylesheet']"))) {
      rewrite(el, "href");
    }
    for (const el of Array.from(doc.querySelectorAll("image"))) {
      rewrite(el, "href");
    }
  }
}

// ── ZIP helpers ───────────────────────────────────────────────────────────────

function unzipEpub(data: ArrayBuffer): Record<string, Uint8Array> {
  try {
    return unzipSync(new Uint8Array(data));
  } catch (error) {
    throw new ScopeException([
      issue("ZIP_INVALID", "INSPECT_PUBLICATION", true, { reason: String(error) }),
    ]);
  }
}

function findOpf(files: Record<string, Uint8Array>): { opfPath: string; opfDir: string } {
  const containerXml = files["META-INF/container.xml"];
  if (!containerXml) {
    throw new ScopeException([issue("CONTAINER_XML_MISSING", "INSPECT_PUBLICATION", true)]);
  }
  const containerDoc = new DOMParser().parseFromString(
    new TextDecoder().decode(containerXml),
    "application/xml",
  );
  const rootfile = containerDoc.getElementsByTagNameNS("*", "rootfile")[0] ?? null;
  const opfPath = rootfile?.getAttribute("full-path");
  if (!opfPath) {
    throw new ScopeException([issue("CONTAINER_XML_INVALID", "INSPECT_PUBLICATION", true)]);
  }
  const opfDir = opfPath.includes("/") ? opfPath.substring(0, opfPath.lastIndexOf("/") + 1) : "";
  return { opfPath, opfDir };
}

// ── OPF parsing ───────────────────────────────────────────────────────────────

function parseXml(files: Record<string, Uint8Array>, path: string): Document {
  const raw = files[path];
  if (!raw) {
    throw new ScopeException([issue("PACKAGE_DOCUMENT_MISSING", "INSPECT_PUBLICATION", true)]);
  }
  return new DOMParser().parseFromString(new TextDecoder().decode(raw), "application/xml");
}

function parseOpf(
  opfDoc: Document,
): { manifest: Map<string, { href: string; mediaType: string }>; spine: EpubDriverSpineItem[] } {
  const manifest = new Map<string, { href: string; mediaType: string }>();
  for (const item of Array.from(opfDoc.getElementsByTagNameNS("*", "item"))) {
    const id = item.getAttribute("id") ?? "";
    const href = item.getAttribute("href") ?? "";
    const mediaType = item.getAttribute("media-type") ?? "";
    if (id && href) manifest.set(id, { href: decodeURIComponent(href), mediaType });
  }

  const spine: EpubDriverSpineItem[] = Array.from(
    opfDoc.getElementsByTagNameNS("*", "itemref"),
  ).map((ref) => {
    const idref = ref.getAttribute("idref") ?? "";
    const item = manifest.get(idref);
    const linear = ref.getAttribute("linear") !== "no";
    return { id: idref, href: item?.href ?? idref, linear };
  });

  if (spine.length === 0) {
    throw new ScopeException([issue("SPINE_EMPTY", "INSPECT_PUBLICATION", true)]);
  }

  return { manifest, spine };
}

// ── Navigation (NCX + nav.xhtml) ─────────────────────────────────────────────

function parseNavigation(
  opfDoc: Document,
  opfDir: string,
  files: Record<string, Uint8Array>,
): EpubDriverNavNode[] {
  // EPUB 3: look for <item properties="nav">
  const navItem = Array.from(opfDoc.getElementsByTagNameNS("*", "item")).find(
    (el) => el.getAttribute("properties")?.includes("nav"),
  );
  if (navItem) {
    const navHref = opfDir + decodeURIComponent(navItem.getAttribute("href") ?? "");
    const raw = files[navHref];
    if (raw) {
      const navDoc = new DOMParser().parseFromString(
        new TextDecoder().decode(raw),
        "application/xhtml+xml",
      );
      const navEl =
        navDoc.querySelector('nav[epub\\:type="toc"]') ??
        Array.from(navDoc.getElementsByTagNameNS("*", "nav")).find(
          (el) => el.getAttribute("epub:type") === "toc" || el.getAttribute("role") === "doc-toc",
        ) ??
        navDoc.getElementsByTagNameNS("*", "nav")[0] ??
        null;
      if (navEl) return parseNavXhtml(navEl);
    }
  }

  // EPUB 2 fallback: NCX
  const ncxItem = Array.from(opfDoc.getElementsByTagNameNS("*", "item")).find((el) =>
    el.getAttribute("media-type")?.includes("ncx"),
  );
  if (ncxItem) {
    const ncxHref = opfDir + decodeURIComponent(ncxItem.getAttribute("href") ?? "");
    const raw = files[ncxHref];
    if (raw) {
      const ncxDoc = new DOMParser().parseFromString(
        new TextDecoder().decode(raw),
        "application/xml",
      );
      return parseNcx(ncxDoc);
    }
  }

  return [];
}

function parseNavXhtml(nav: Element): EpubDriverNavNode[] {
  function parseOl(ol: Element): EpubDriverNavNode[] {
    const directLis = Array.from(ol.getElementsByTagNameNS("*", "li")).filter(
      (li) => li.parentElement === ol,
    );
    return directLis.map((li, i) => {
      const a = li.getElementsByTagNameNS("*", "a")[0] ?? null;
      const href = a?.getAttribute("href") ?? "";
      const label = a?.textContent?.trim() ?? `item-${i}`;
      const childOl = li.getElementsByTagNameNS("*", "ol")[0] ?? null;
      return { id: href || `nav-${i}`, label, href, children: childOl ? parseOl(childOl) : [] };
    });
  }
  const ol = nav.getElementsByTagNameNS("*", "ol")[0] ?? null;
  return ol ? parseOl(ol) : [];
}

function parseNcx(doc: Document): EpubDriverNavNode[] {
  function parsePoints(parent: Element | Document): EpubDriverNavNode[] {
    return Array.from(parent.getElementsByTagNameNS("*", "navPoint"))
      .filter((pt) => pt.parentElement === (parent instanceof Document ? parent.documentElement : parent))
      .map((pt) => {
        const label = pt.getElementsByTagNameNS("*", "text")[0]?.textContent?.trim() ?? "";
        const src = pt.getElementsByTagNameNS("*", "content")[0]?.getAttribute("src") ?? "";
        return { id: pt.getAttribute("id") ?? src, label, href: src, children: parsePoints(pt) };
      });
  }
  const navMap = doc.getElementsByTagNameNS("*", "navMap")[0];
  return navMap ? parsePoints(navMap) : [];
}

// ── Cover ─────────────────────────────────────────────────────────────────────

function parseCover(
  opfDoc: Document,
  opfDir: string,
  files: Record<string, Uint8Array>,
): Blob | null {
  // EPUB 3: <item properties="cover-image">
  const allItems = Array.from(opfDoc.getElementsByTagNameNS("*", "item"));
  let coverItem = allItems.find((el) => el.getAttribute("properties")?.includes("cover-image"));
  // EPUB 2: <meta name="cover" content="cover-id">
  if (!coverItem) {
    const metaCoverId = Array.from(opfDoc.getElementsByTagNameNS("*", "meta"))
      .find((el) => el.getAttribute("name") === "cover")?.getAttribute("content");
    if (metaCoverId) coverItem = allItems.find((el) => el.getAttribute("id") === metaCoverId);
  }
  if (!coverItem) return null;

  const href = opfDir + decodeURIComponent(coverItem.getAttribute("href") ?? "");
  const raw = files[href];
  if (!raw) return null;

  const mt = coverItem.getAttribute("media-type") ?? guessMimeType(href);
  const blob = new Blob([toArrayBuffer(raw)], { type: mt });
  // Track the URL for revocation if callers create one; return Blob directly
  return blob;
}

// ── Full inspection ───────────────────────────────────────────────────────────

function getDcText(opfDoc: Document, localName: string): string {
  const DC = "http://purl.org/dc/elements/1.1/";
  // getElementsByTagNameNS with wildcard namespace also matches Dublin Core elements
  return (
    opfDoc.getElementsByTagNameNS(DC, localName)[0]?.textContent?.trim() ??
    opfDoc.getElementsByTagNameNS("*", localName)[0]?.textContent?.trim() ??
    ""
  );
}

function buildInspection(
  opfDoc: Document,
  opfDir: string,
  files: Record<string, Uint8Array>,
): EpubDriverInspection {
  const title = getDcText(opfDoc, "title");
  const creator = getDcText(opfDoc, "creator");
  const language = getDcText(opfDoc, "language") || undefined;
  const description = getDcText(opfDoc, "description") || undefined;

  const { spine } = parseOpf(opfDoc);
  const navigation = parseNavigation(opfDoc, opfDir, files);
  const cover = parseCover(opfDoc, opfDir, files);

  return {
    metadata: { title, creator, ...(language ? { language } : {}), ...(description ? { description } : {}) },
    navigation,
    spine,
    cover,
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Resolve a relative href against a base directory path */
function resolveHref(base: string, href: string): string {
  if (href.startsWith("/")) return href.slice(1);
  if (href.startsWith("http") || href.startsWith("data:") || href.startsWith("blob:")) return href;

  const parts = (base + href).split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part !== ".") resolved.push(part);
  }
  return resolved.join("/");
}

function serialiseDoc(doc: Document): string {
  const s = new XMLSerializer();
  // Serialise the full document so ChapterFrame can extract head styles + body
  try {
    return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
  } catch {
    return s.serializeToString(doc);
  }
}

/** Copy a fflate Uint8Array (which may have an ArrayBufferLike buffer) to a plain ArrayBuffer */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function guessMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    css: "text/css", woff: "font/woff", woff2: "font/woff2",
    ttf: "font/ttf", otf: "font/otf",
  };
  return map[ext] ?? "application/octet-stream";
}
