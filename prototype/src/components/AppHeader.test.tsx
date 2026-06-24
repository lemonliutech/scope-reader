import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("toggles the global theme from the top bar", () => {
    const onToggleTheme = vi.fn();

    render(
      <AppHeader
        pathname="/"
        books={[]}
        currentBookId={null}
        onNavigate={vi.fn()}
        onSelectBook={vi.fn()}
        onImport={vi.fn()}
        onAbout={vi.fn()}
        theme="LIGHT"
        onToggleTheme={onToggleTheme}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "切换到深色主题" }));

    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });
});
