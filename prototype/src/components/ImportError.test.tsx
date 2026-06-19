import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { issue } from "../domain/scopeError";
import { ImportError } from "./ImportError";

describe("ImportError", () => {
  it("renders blocking issues with userMessage, suggestion, and code", () => {
    const issues = [
      issue("UNSUPPORTED_FIXED_LAYOUT", "CHECK_CAPABILITIES", true),
      issue("UNSUPPORTED_DRM", "CHECK_CAPABILITIES", true),
    ];
    render(<ImportError issues={issues} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("UNSUPPORTED_FIXED_LAYOUT")).toBeInTheDocument();
    expect(screen.getByText("UNSUPPORTED_DRM")).toBeInTheDocument();
    // Each issue renders its Chinese userMessage and suggestion
    const codes = screen.getAllByRole("code");
    const codeTexts = codes.map((el) => el.textContent);
    expect(codeTexts).toContain("UNSUPPORTED_FIXED_LAYOUT");
    expect(codeTexts).toContain("UNSUPPORTED_DRM");
  });

  it("renders nothing when issues is empty", () => {
    const { container } = render(<ImportError issues={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders warnings without role=alert", () => {
    const issues = [issue("NAVIGATION_INVALID", "INSPECT_PUBLICATION", false)];
    render(<ImportError issues={issues} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("NAVIGATION_INVALID")).toBeInTheDocument();
  });
});
