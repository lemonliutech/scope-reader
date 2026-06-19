import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChapterDocument, PublicationInspection } from "../domain/publication";
import { ReaderPage } from "./ReaderPage";

const inspection: PublicationInspection = {
  metadata: { title: "Test Book", authors: ["Test Author"], language: null, description: null, cover: null },
  navigation: [],
  readingOrder: [{ id: "ch1", label: "Chapter 1", target: { format: "EPUB", locator: "chapter1.xhtml" }, linear: true }],
  issues: [],
};

const chapter: ChapterDocument = {
  id: "ch1",
  title: "Chapter 1",
  html: "<p>real chapter content</p>",
  baseUrl: "https://example.com/",
  warnings: [],
};

describe("ReaderPage", () => {
  it("shows placeholder when no publication is open", () => {
    render(<ReaderPage publication={null} chapter={null} locator={null} temporary={false} onOpenTarget={vi.fn()} onOpenLibrary={vi.fn()} />);
    expect(screen.getByText("还没有打开图书")).toBeInTheDocument();
  });

  it("renders ChapterFrame when a chapter is provided", async () => {
    await act(async () => {
      render(<ReaderPage publication={inspection} chapter={chapter} locator={null} temporary={false} onOpenTarget={vi.fn()} onOpenLibrary={vi.fn()} />);
    });
    // Chapter content is injected into a .chapter-content div (no iframe)
    expect(document.querySelector(".chapter-content")).toBeInTheDocument();
    expect(screen.getByText("real chapter content")).toBeInTheDocument();
  });

  it("shows a temporary notice when book cannot be saved", () => {
    render(<ReaderPage publication={inspection} chapter={chapter} locator={null} temporary={true} onOpenTarget={vi.fn()} onOpenLibrary={vi.fn()} />);
    expect(screen.getByText(/本次进度无法保存/)).toBeInTheDocument();
  });

  it("shows reading order as navigation when no nav nodes exist", () => {
    render(<ReaderPage publication={inspection} chapter={null} locator={null} temporary={false} onOpenTarget={vi.fn()} onOpenLibrary={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Chapter 1" })).toBeInTheDocument();
  });
});
