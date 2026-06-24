import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChapterDocument, PublicationInspection, ReaderPreferences } from "../domain/publication";
import { ReaderPage } from "./ReaderPage";

const preferences: ReaderPreferences = { fontSize: 16, lineHeight: 1.6, theme: "LIGHT" };

const inspection: PublicationInspection = {
  metadata: { title: "Test Book", authors: ["Test Author"], language: null, description: null, cover: null },
  navigation: [],
  readingOrder: [{ id: "ch1", label: "Chapter 1", target: { format: "EPUB", locator: "ch1" }, linear: true }],
  issues: [],
};

const chapter: ChapterDocument = {
  id: "ch1",
  title: "Chapter 1",
  html: "<html><head></head><body><p>real chapter content</p></body></html>",
  baseUrl: "",
  warnings: [],
};

describe("ReaderPage", () => {
  it("shows placeholder when no publication is open", () => {
    render(<ReaderPage publication={null} chapter={null} locator={null} preferences={preferences} temporary={false} onOpenTarget={vi.fn()} onOpenLibrary={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByText("开始阅读")).toBeInTheDocument();
  });

  it("renders ChapterFrame when a chapter is provided", async () => {
    await act(async () => {
      render(<ReaderPage publication={inspection} chapter={chapter} locator={null} preferences={preferences} temporary={false} onOpenTarget={vi.fn()} onOpenLibrary={vi.fn()} onImport={vi.fn()} />);
    });
    expect(document.querySelector(".chapter-content")).toBeInTheDocument();
    expect(screen.getByText("real chapter content")).toBeInTheDocument();
  });

  it("passes dark theme preferences into chapter rendering", async () => {
    const darkPrefs: ReaderPreferences = { ...preferences, theme: "DARK" };
    await act(async () => {
      render(<ReaderPage publication={inspection} chapter={chapter} locator={null} preferences={darkPrefs} temporary={false} onOpenTarget={vi.fn()} onOpenLibrary={vi.fn()} onImport={vi.fn()} />);
    });

    const el = document.querySelector(".chapter-content") as HTMLElement;
    expect(el.style.background).toBe("var(--page-bg)");
  });

  it("shows a temporary notice when book cannot be saved", () => {
    render(<ReaderPage publication={inspection} chapter={chapter} locator={null} preferences={preferences} temporary={true} onOpenTarget={vi.fn()} onOpenLibrary={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByText(/本次进度无法保存/)).toBeInTheDocument();
  });

  it("shows reading order as navigation when no nav nodes exist", () => {
    render(<ReaderPage publication={inspection} chapter={null} locator={null} preferences={preferences} temporary={false} onOpenTarget={vi.fn()} onOpenLibrary={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Chapter 1" })).toBeInTheDocument();
  });
});
