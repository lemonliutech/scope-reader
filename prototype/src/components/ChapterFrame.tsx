import { useEffect, useMemo, useRef } from "react";
import type { ChapterDocument, ReaderPreferences } from "../domain/publication";

type ChapterFrameProps = {
  chapter: ChapterDocument;
  preferences: ReaderPreferences;
  anchor: string | null;
  onDispose: () => void;
  onExternalLink: (url: string) => void;
};

export function ChapterFrame({ chapter, preferences, anchor, onDispose, onExternalLink }: ChapterFrameProps) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => onDispose, [onDispose]);

  const srcDoc = useMemo(
    () => buildSafeChapterDocument(chapter, preferences),
    [chapter, preferences],
  );

  const scrollToAnchor = (id: string): void => {
    const doc = ref.current?.contentDocument;
    const el = doc?.getElementById(id) ?? doc?.querySelector(`[name="${id.replaceAll('"', '\\"')}"]`);
    el?.scrollIntoView({ block: "start" });
  };

  const resize = (): void => {
    const root = ref.current?.contentDocument?.documentElement;
    if (root && ref.current) ref.current.style.height = `${root.scrollHeight}px`;
  };

  // Register a capture-phase click listener to intercept external links
  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;

    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest("[data-external-url]");
      if (!target) return;
      const url = target.getAttribute("data-external-url");
      if (url) {
        event.preventDefault();
        onExternalLink(url);
      }
    };

    const onLoad = () => {
      iframe.contentDocument?.addEventListener("click", onClick, true);
    };

    iframe.addEventListener("load", onLoad);
    return () => {
      iframe.removeEventListener("load", onLoad);
      iframe.contentDocument?.removeEventListener("click", onClick, true);
    };
  }, [onExternalLink]);

  // Scroll to anchor after the iframe document loads
  const handleLoad = (): void => {
    resize();
    if (anchor) scrollToAnchor(anchor);
  };

  // Scroll when anchor changes without a full chapter reload (same file, different section)
  useEffect(() => {
    if (anchor) scrollToAnchor(anchor);
  }, [anchor]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <iframe
      ref={ref}
      className="chapter-frame"
      sandbox="allow-same-origin"
      title={chapter.title}
      srcDoc={srcDoc}
      onLoad={handleLoad}
      style={{ width: "100%", border: 0, overflow: "hidden", display: "block" }}
    />
  );
}

const BLOCKED_TAGS = new Set(["script", "form", "object", "embed"]);
const EVENT_ATTR_RE = /^on[a-z]/i;

function buildSafeChapterDocument(chapter: ChapterDocument, preferences: ReaderPreferences): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(chapter.html, "text/html");

  // Remove dangerous elements
  for (const tag of BLOCKED_TAGS) {
    for (const el of Array.from(doc.querySelectorAll(tag))) el.remove();
  }

  // Remove meta refresh
  for (const meta of Array.from(doc.querySelectorAll('meta[http-equiv="refresh"]'))) meta.remove();

  // Remove event attributes and handle remote URLs
  const walker = doc.createTreeWalker(doc.body ?? doc, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.currentNode;
  while (node) {
    const el = node as Element;
    // Event attributes
    for (const attr of Array.from(el.attributes)) {
      if (EVENT_ATTR_RE.test(attr.name)) el.removeAttribute(attr.name);
    }
    // Remote src
    const src = el.getAttribute("src");
    if (src && isRemoteUrl(src)) el.removeAttribute("src");
    // Remote href — convert to data-external-url for click interception
    const href = el.getAttribute("href");
    if (href && isRemoteUrl(href)) {
      el.removeAttribute("href");
      el.setAttribute("data-external-url", href);
    }
    node = walker.nextNode();
  }

  // Inject reader preferences
  const style = doc.createElement("style");
  style.textContent = `
    :root { font-size: ${preferences.fontSize}px; line-height: ${preferences.lineHeight}; }
    body { margin: 0; padding: 1rem 1.5rem; box-sizing: border-box;
           background: ${preferences.theme === "DARK" ? "#1a1a1a" : "#fff"};
           color: ${preferences.theme === "DARK" ? "#e0e0e0" : "#1a1a1a"}; }
  `;
  (doc.head ?? doc.documentElement).prepend(style);

  return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
}

function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || url.startsWith("//");
}
