import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { DEMO_BOOKS } from "../data/demoBooks";
import { CurrentBookSwitcher } from "./CurrentBookSwitcher";

it("opens recent books and selects one", () => {
  const onSelect = vi.fn();
  render(
    <CurrentBookSwitcher
      currentBook={DEMO_BOOKS[0]!}
      recentBooks={DEMO_BOOKS.slice(0, 2)}
      onSelect={onSelect}
      onImport={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /人类简史/ }));
  fireEvent.click(screen.getByRole("menuitem", { name: /乡土中国/ }));
  expect(onSelect).toHaveBeenCalledWith("from-the-soil");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});
