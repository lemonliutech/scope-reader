import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEMO_BOOKS } from "../data/demoBooks";
import { LibraryPage } from "./LibraryPage";

const library = { books: DEMO_BOOKS };

describe("LibraryPage", () => {
  it("searches by author and opens the matching book", () => {
    const onOpen = vi.fn();
    render(
      <LibraryPage
        library={library}
        onOpen={onOpen}
        onRequestDelete={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("搜索图书"), { target: { value: "费孝通" } });
    expect(screen.getByText("乡土中国")).toBeInTheDocument();
    expect(screen.queryByText("人类简史")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "继续阅读《乡土中国》" }));
    expect(onOpen).toHaveBeenCalledWith("from-the-soil");
  });

  it("shows a recoverable no-results state", () => {
    render(
      <LibraryPage
        library={library}
        onOpen={vi.fn()}
        onRequestDelete={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("搜索图书"), { target: { value: "不存在" } });
    expect(screen.getByText("没有匹配的图书")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "清除条件" }));
    expect(screen.getByText("人类简史")).toBeInTheDocument();
  });

  it("requests deletion with the selected book id", () => {
    const onRequestDelete = vi.fn();
    render(
      <LibraryPage
        library={library}
        onOpen={vi.fn()}
        onRequestDelete={onRequestDelete}
        onImport={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "删除《人类简史》" }));
    expect(onRequestDelete).toHaveBeenCalledWith("sapiens");
  });

  it("shows an import action when the library is empty", () => {
    render(
      <LibraryPage
        library={{ books: [] }}
        onOpen={vi.fn()}
        onRequestDelete={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /导入第一本图书/ })).toBeInTheDocument();
  });
});
