import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChapterDocument, ReaderPreferences } from "../domain/publication";
import { ChapterFrame } from "./ChapterFrame";

const prefs: ReaderPreferences = { fontSize: 16, lineHeight: 1.6, theme: "LIGHT" };

function makeChapter(html: string, id = "ch1"): ChapterDocument {
  return {
    id,
    title: "Chapter 1",
    html: `<!DOCTYPE html><html><head></head><body>${html}</body></html>`,
    baseUrl: "",
    warnings: [],
  };
}

describe("ChapterFrame", () => {
  it("renders chapter text content in the page DOM (no iframe)", async () => {
    await act(async () => {
      render(
        <ChapterFrame
          chapter={makeChapter("<p>Hello world</p>")}
          preferences={prefs}
          anchor={null}
          onExternalLink={vi.fn()} onInternalLink={vi.fn()}
        />,
      );
    });
    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("strips script and blocked tags from injected HTML", async () => {
    await act(async () => {
      render(
        <ChapterFrame
          chapter={makeChapter('<script>alert("xss")</script><p>Safe</p><form><input/></form>')}
          preferences={prefs}
          anchor={null}
          onExternalLink={vi.fn()} onInternalLink={vi.fn()}
        />,
      );
    });
    expect(screen.getByText("Safe")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("form")).toBeNull();
  });

  it("removes remote src and converts remote href to data-external-url", async () => {
    await act(async () => {
      render(
        <ChapterFrame
          chapter={makeChapter(
            '<img src="https://evil.com/track.png"/><a href="https://example.com">link</a>',
          )}
          preferences={prefs}
          anchor={null}
          onExternalLink={vi.fn()} onInternalLink={vi.fn()}
        />,
      );
    });
    const img = document.querySelector("img");
    expect(img?.getAttribute("src")).toBeNull();
    const a = document.querySelector("a");
    expect(a?.getAttribute("href")).toBeNull();
    expect(a?.getAttribute("data-external-url")).toBe("https://example.com");
  });

  it("fires onExternalLink when a converted external link is clicked", async () => {
    const onExternalLink = vi.fn();
    await act(async () => {
      render(
        <ChapterFrame
          chapter={makeChapter('<a href="https://example.com">Visit</a>')}
          preferences={prefs}
          anchor={null}
          onExternalLink={onExternalLink}
          onInternalLink={vi.fn()}
        />,
      );
    });
    await act(async () => {
      screen.getByText("Visit").click();
    });
    expect(onExternalLink).toHaveBeenCalledWith("https://example.com");
  });
});
