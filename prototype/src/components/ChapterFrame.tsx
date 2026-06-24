import { useEffect, useRef } from "react";
import prismOneDark from "prism-themes/themes/prism-one-dark.css?raw";
import type { ChapterDocument, ReaderPreferences } from "../domain/publication";

type ChapterFrameProps = {
  chapter: ChapterDocument;
  preferences: ReaderPreferences;
  anchor: string | null;
  onExternalLink: (url: string) => void;
  onInternalLink: (locator: string) => void;
};

export function ChapterFrame({ chapter, preferences, anchor, onExternalLink, onInternalLink }: ChapterFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep refs so event-delegation handlers always call the latest version
  const onExternalLinkRef = useRef(onExternalLink);
  onExternalLinkRef.current = onExternalLink;
  const onInternalLinkRef = useRef(onInternalLink);
  onInternalLinkRef.current = onInternalLink;
  // Keep anchor in a ref so the async HTML callback can read the latest value
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  // Keep chapter baseUrl in a ref for the link handler
  const chapterBaseUrlRef = useRef(chapter.baseUrl);
  chapterBaseUrlRef.current = chapter.baseUrl;
  // Track scoped <style> elements so we can always remove previous ones
  const styleElRef = useRef<HTMLStyleElement | null>(null);
  const darkCodeStyleRef = useRef<HTMLStyleElement | null>(null);

  // Inject sanitized body HTML and scoped EPUB styles when the chapter changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Remove previous chapter's styles immediately
    styleElRef.current?.remove();
    styleElRef.current = null;
    darkCodeStyleRef.current?.remove();
    darkCodeStyleRef.current = null;

    let cancelled = false;

    void (async () => {
      const isDark = preferences.theme === "DARK";
      const { bodyHtml, inlineStyles, linkUrls } = parseChapter(chapter.html, isDark);

      // Fetch CSS from epubjs-generated blob: URLs (fast — already in memory)
      const fetchedCss = (
        await Promise.all(linkUrls.map((url) => fetch(url).then((r) => r.text()).catch(() => "")))
      ).join("\n");

      if (cancelled) return;

      container.innerHTML = bodyHtml;

      // Scroll to anchor (if any) or reset to top — must run after HTML is in the DOM
      const currentAnchor = anchorRef.current;
      if (currentAnchor) {
        const el =
          container.querySelector(`#${CSS.escape(currentAnchor)}`) ??
          container.querySelector(`[name="${currentAnchor.replaceAll('"', '\\"')}"]`);
        el?.scrollIntoView({ block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "instant" });
      }

      const isDarkTheme = preferences.theme === "DARK";
      const allCss = [inlineStyles, fetchedCss, isDarkTheme ? darkContentCss : ""].join("\n").trim();
      if (allCss) {
        const style = document.createElement("style");
        style.textContent = `@scope (.chapter-content) {\n${allCss}\n}`;
        document.head.appendChild(style);
        styleElRef.current = style;
      }
      if (isDarkTheme) {
        const codeStyle = document.createElement("style");
        codeStyle.textContent = darkCodeCss;
        document.head.appendChild(codeStyle);
        darkCodeStyleRef.current = codeStyle;
      }
    })();

    return () => {
      cancelled = true;
      styleElRef.current?.remove();
      styleElRef.current = null;
      darkCodeStyleRef.current?.remove();
      darkCodeStyleRef.current = null;
    };
  }, [chapter.id, preferences.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to anchor when anchor changes within the same chapter (HTML already in DOM)
  useEffect(() => {
    if (!anchor || !containerRef.current) return;
    const el =
      containerRef.current.querySelector(`#${CSS.escape(anchor)}`) ??
      containerRef.current.querySelector(`[name="${anchor.replaceAll('"', '\\"')}"]`);
    el?.scrollIntoView({ block: "start" });
  }, [anchor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Link interception via event delegation (registered once)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor) return;

      // External link (set by parseChapter sanitisation)
      const externalUrl = anchor.getAttribute("data-external-url");
      if (externalUrl) {
        event.preventDefault();
        onExternalLinkRef.current(externalUrl);
        return;
      }

      // Internal EPUB link — resolve relative href and navigate within reader
      const href = anchor.getAttribute("href");
      if (href && !isRemoteUrl(href) && !href.startsWith("mailto:") && !href.startsWith("#")) {
        event.preventDefault();
        const locator = resolveEpubLocator(href, chapterBaseUrlRef.current);
        onInternalLinkRef.current(locator);
        return;
      }

      // Same-page fragment link — scroll within current chapter
      if (href?.startsWith("#")) {
        event.preventDefault();
        const fragment = href.slice(1);
        const el =
          container.querySelector(`#${CSS.escape(fragment)}`) ??
          container.querySelector(`[name="${fragment.replaceAll('"', '\\"')}"]`);
        el?.scrollIntoView({ block: "start" });
      }
    };
    container.addEventListener("click", handler);
    return () => container.removeEventListener("click", handler);
  }, []);

  return (
    <div
      ref={containerRef}
      className="chapter-content"
      style={{
        fontSize: `${preferences.fontSize}px`,
        lineHeight: preferences.lineHeight,
        background: "var(--page-bg)",
        color: "var(--text)",
      }}
    />
  );
}

// ── Dark mode content CSS (Readium approach) ────────────────────────────────

const darkContentCss = `
:scope { color-scheme: dark; }

*:not(pre):not(pre *):not(code):not(a) {
  color: inherit !important;
  background-color: transparent !important;
  border-color: var(--soft-border) !important;
}

:scope { background-color: var(--page-bg) !important; }

a { color: var(--link) !important; }

img, svg, video, canvas, picture { color: initial !important; }

h1, h2, h3, h4, h5, h6 { color: var(--text) !important; }

table, th, td { border-color: var(--soft-border) !important; }
th { background: var(--surface-soft) !important; color: var(--text) !important; }

hr { border-color: var(--soft-border) !important; background: var(--soft-border) !important; }

blockquote {
  border-left-color: var(--border) !important;
  color: var(--muted) !important;
}

pre, pre[class*="language-"], code[class*="language-"] {
  background: hsl(220, 13%, 18%) !important;
  color: hsl(220, 14%, 71%) !important;
  border: none !important;
  border-radius: 6px;
  padding: 16px !important;
}

pre code, pre code * {
  background: transparent !important;
}

.token-line {
  color: hsl(220, 14%, 71%) !important;
  background: transparent !important;
}

.token {
  color: hsl(220, 14%, 71%) !important;
  background: transparent !important;
}

.token.comment, .token.prolog, .token.cdata {
  color: hsl(220, 10%, 40%) !important;
}

.token.attr-name, .token.class-name, .token.boolean, .token.constant, .token.number, .token.atrule {
  color: hsl(29, 54%, 61%) !important;
}

.token.keyword {
  color: hsl(286, 60%, 67%) !important;
}

.token.property, .token.tag, .token.symbol, .token.deleted, .token.important {
  color: hsl(355, 65%, 65%) !important;
}

.token.selector, .token.string, .token.char, .token.builtin, .token.inserted, .token.regex, .token.attr-value {
  color: hsl(95, 38%, 62%) !important;
}

.token.variable, .token.operator, .token.function {
  color: hsl(207, 82%, 66%) !important;
}

.token.url {
  color: hsl(187, 47%, 55%) !important;
}

:not(pre) > code {
  color: #c9a96e !important;
  background: #2a3139 !important;
  padding: 2px 5px;
  border-radius: 3px;
}

.code-example-note, .code-example, .example, .note {
  color: var(--muted) !important;
  background: var(--surface-soft) !important;
  border: 1px solid var(--soft-border) !important;
}
`;

// ── Dark code theme (injected as a separate <style> to avoid @scope nesting issues) ──

const darkCodeCss = prismOneDark.replace(
  /^([^\s@{][^{]*)\{/gm,
  (_, selector) => `.chapter-content ${selector.trim()} {`,
);

// ── HTML parsing & sanitisation ───────────────────────────────────────────────

const BLOCKED_TAGS = new Set(["script", "form", "object", "embed", "iframe"]);
const EVENT_ATTR_RE = /^on[a-z]/i;

function parseChapter(html: string, isDark = false): {
  bodyHtml: string;
  inlineStyles: string;
  linkUrls: string[];
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Remove dangerous elements
  for (const tag of BLOCKED_TAGS) {
    for (const el of Array.from(doc.querySelectorAll(tag))) el.remove();
  }
  for (const el of Array.from(doc.querySelectorAll('meta[http-equiv="refresh"]'))) el.remove();

  // Strip event attrs; remove remote src; rewrite remote href → data-external-url
  const walker = doc.createTreeWalker(doc.body ?? doc, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.currentNode;
  while (node) {
    const el = node as Element;
    for (const attr of Array.from(el.attributes)) {
      if (EVENT_ATTR_RE.test(attr.name)) el.removeAttribute(attr.name);
    }
    const src = el.getAttribute("src");
    if (src && isRemoteUrl(src)) el.removeAttribute("src");
    const href = el.getAttribute("href");
    if (href && isRemoteUrl(href)) {
      el.removeAttribute("href");
      el.setAttribute("data-external-url", href);
    }
    node = walker.nextNode();
  }

  if (isDark) {
    for (const el of Array.from(doc.querySelectorAll("pre, pre *"))) {
      el.removeAttribute("style");
    }
  }

  const inlineStyles = Array.from(doc.head?.querySelectorAll("style") ?? [])
    .map((s) => s.textContent ?? "")
    .join("\n");

  // Only fetch epubjs-generated blob: / data: URLs (no network requests)
  const linkUrls = Array.from(doc.head?.querySelectorAll('link[rel="stylesheet"]') ?? [])
    .map((l) => l.getAttribute("href") ?? "")
    .filter((url) => url.startsWith("blob:") || url.startsWith("data:"));

  return { bodyHtml: doc.body?.innerHTML ?? "", inlineStyles, linkUrls };
}

function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || url.startsWith("//");
}

// Resolve a relative EPUB href against the current chapter's path (both relative to OPF dir)
function resolveEpubLocator(href: string, chapterBaseUrl: string): string {
  const fakeBase = `epub:///${chapterBaseUrl}`;
  const resolved = new URL(href, fakeBase);
  // pathname starts with "/", strip it; preserve hash fragment
  return resolved.pathname.slice(1) + resolved.hash;
}
