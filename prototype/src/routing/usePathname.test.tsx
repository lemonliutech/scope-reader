import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { usePathname } from "./usePathname";

afterEach(() => history.replaceState({}, "", "/"));

it("navigates and responds to popstate", () => {
  history.replaceState({}, "", "/");
  const { result } = renderHook(() => usePathname());
  act(() => result.current.navigate("/library"));
  expect(result.current.pathname).toBe("/library");
  act(() => {
    history.replaceState({}, "", "/");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(result.current.pathname).toBe("/");
});
