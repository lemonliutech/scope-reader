import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_LIBRARY_STATE } from "../data/demoBooks";
import { STORAGE_KEY, useLibrary } from "./useLibrary";

describe("useLibrary", () => {
  beforeEach(() => localStorage.clear());

  it("falls back to demo data when storage is malformed", () => {
    localStorage.setItem(STORAGE_KEY, "bad");
    const { result } = renderHook(() => useLibrary());
    expect(result.current.books).toHaveLength(DEFAULT_LIBRARY_STATE.books.length);
    expect(result.current.notice).toBe("本地数据无法读取，已恢复演示图书");
  });

  it("deleting the current book clears currentBookId", () => {
    const { result } = renderHook(() => useLibrary());
    act(() => result.current.removeBook("sapiens"));
    expect(result.current.currentBookId).toBeNull();
    expect(result.current.books.some((book) => book.id === "sapiens")).toBe(false);
  });

  it("rejects an imported book that already exists", () => {
    const { result } = renderHook(() => useLibrary());
    act(() => result.current.importBook({ name: "局外人.epub" }));
    expect(() => result.current.importBook({ name: "局外人.epub" })).toThrow("这本图书已经存在");
  });
});
