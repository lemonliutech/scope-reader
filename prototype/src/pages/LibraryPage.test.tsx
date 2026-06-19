import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LibraryBook } from "../storage/schema";
import { LibraryPage } from "./LibraryPage";

function makeBook(opts: { bookId: string; title: string; author?: string; lastOpenedAt?: string | null; importedAt?: string; temporary?: boolean }): LibraryBook {
  return {
    bookId: opts.bookId,
    fileName: `${opts.bookId}.epub`,
    size: 1000,
    metadata: {
      title: opts.title,
      authors: [opts.author ?? "Unknown Author"],
      language: null,
      description: null,
      cover: null,
    },
    location: { format: "EPUB", locator: "", chapterIndex: 0, scrollRatio: 0 },
    importedAt: opts.importedAt ?? "2026-06-16T08:00:00.000Z",
    lastOpenedAt: opts.lastOpenedAt ?? null,
    temporary: opts.temporary ?? false,
  };
}

const books: LibraryBook[] = [
  makeBook({ bookId: "sapiens", title: "人类简史", author: "尤瓦尔·赫拉利", lastOpenedAt: "2026-06-18T02:24:00.000Z" }),
  makeBook({ bookId: "from-the-soil", title: "乡土中国", author: "费孝通", lastOpenedAt: "2026-06-17T09:00:00.000Z" }),
  makeBook({ bookId: "1587", title: "万历十五年", author: "黄仁宇", importedAt: "2026-06-18T01:00:00.000Z" }),
];

describe("LibraryPage", () => {
  it("searches by author and opens the matching book", () => {
    const onOpen = vi.fn();
    render(<LibraryPage books={books} onOpen={onOpen} onRequestDelete={vi.fn()} onImport={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("搜索图书"), { target: { value: "费孝通" } });
    expect(screen.getByText("乡土中国")).toBeInTheDocument();
    expect(screen.queryByText("人类简史")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "继续阅读《乡土中国》" }));
    expect(onOpen).toHaveBeenCalledWith("from-the-soil");
  });

  it("shows a recoverable no-results state", () => {
    render(<LibraryPage books={books} onOpen={vi.fn()} onRequestDelete={vi.fn()} onImport={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("搜索图书"), { target: { value: "不存在" } });
    expect(screen.getByText("没有匹配的图书")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "清除条件" }));
    expect(screen.getByText("人类简史")).toBeInTheDocument();
  });

  it("requests deletion with the selected book id", () => {
    const onRequestDelete = vi.fn();
    render(<LibraryPage books={books} onOpen={vi.fn()} onRequestDelete={onRequestDelete} onImport={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "删除《人类简史》" }));
    expect(onRequestDelete).toHaveBeenCalledWith("sapiens");
  });

  it("shows an import action when the library is empty", () => {
    render(<LibraryPage books={[]} onOpen={vi.fn()} onRequestDelete={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByRole("button", { name: /导入第一本图书/ })).toBeInTheDocument();
  });

  it("shows a temporary notice for books that cannot be saved", () => {
    const tempBook = makeBook({ bookId: "temp", title: "临时图书", temporary: true });
    render(<LibraryPage books={[tempBook]} onOpen={vi.fn()} onRequestDelete={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByText(/本次进度无法保存/)).toBeInTheDocument();
  });
});
