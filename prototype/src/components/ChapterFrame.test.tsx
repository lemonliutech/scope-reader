import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChapterDocument, ReaderPreferences } from "../domain/publication";
import { ChapterFrame } from "./ChapterFrame";

function makeChapter(html: string): ChapterDocument {
  return { id: "ch1", title: "Chapter 1", html, baseUrl: "https://example.com/", warnings: [] };
}

const prefs: ReaderPreferences = { fontSize: 16, lineHeight: 1.5, theme: "LIGHT" };

describe("ChapterFrame", () => {
  it("renders an iframe with sandbox=allow-same-origin only (no scripts)", () => {
    const chapter = makeChapter("<p>Hello</p>");
    render(<ChapterFrame chapter={chapter} preferences={prefs} anchor={null} onDispose={() => {}} onExternalLink={() => {}} />);

    const iframe = screen.getByTitle("Chapter 1") as HTMLIFrameElement;
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe.getAttribute("sandbox")).toBe("allow-same-origin");
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-scripts");
  });

  it("strips script tags from srcDoc", () => {
    const chapter = makeChapter(
      '<p>text</p><script>parent.__epubScriptRan=true</script>',
    );
    render(<ChapterFrame chapter={chapter} preferences={prefs} anchor={null} onDispose={() => {}} onExternalLink={() => {}} />);

    const iframe = screen.getByTitle("Chapter 1") as HTMLIFrameElement;
    expect(iframe.srcdoc).not.toContain("<script");
    expect(iframe.srcdoc).not.toContain("epubScriptRan");
  });

  it("removes remote src/href from embedded resources", () => {
    const chapter = makeChapter(
      '<img src="https://remote.example.com/img.png" alt="img" /><p>text</p>',
    );
    render(<ChapterFrame chapter={chapter} preferences={prefs} anchor={null} onDispose={() => {}} onExternalLink={() => {}} />);

    const iframe = screen.getByTitle("Chapter 1") as HTMLIFrameElement;
    expect(iframe.srcdoc).not.toContain("https://remote.example.com/img.png");
  });

  it("calls onDispose when unmounted", () => {
    const onDispose = vi.fn();
    const chapter = makeChapter("<p>Hello</p>");
    const { unmount } = render(
      <ChapterFrame chapter={chapter} preferences={prefs} anchor={null} onDispose={onDispose} onExternalLink={() => {}} />,
    );
    unmount();
    expect(onDispose).toHaveBeenCalledOnce();
  });
});
