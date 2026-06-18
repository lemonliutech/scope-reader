import { useEffect, useMemo, useState } from "react";
import { DEFAULT_LIBRARY_STATE } from "../data/demoBooks";
import type { LibrarySnapshot, LocalBook } from "../data/demoBooks";
import { createImportedBook, parseLibraryState } from "./libraryStore";

export const STORAGE_KEY = "scope.prototype.library.v1";

type LibraryState = LibrarySnapshot & {
  notice: string;
};

function loadInitialState(): LibraryState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LIBRARY_STATE, books: [...DEFAULT_LIBRARY_STATE.books], notice: "" };
    const parsed = parseLibraryState(raw);
    return parsed
      ? { ...parsed, notice: "" }
      : {
          ...DEFAULT_LIBRARY_STATE,
          books: [...DEFAULT_LIBRARY_STATE.books],
          notice: "本地数据无法读取，已恢复演示图书",
        };
  } catch {
    return {
      ...DEFAULT_LIBRARY_STATE,
      books: [...DEFAULT_LIBRARY_STATE.books],
      notice: "本地存储不可用，本次修改不会保留",
    };
  }
}

export function useLibrary() {
  const [state, setState] = useState<LibraryState>(loadInitialState);
  const currentBook = useMemo(
    () => state.books.find((book) => book.id === state.currentBookId) ?? null,
    [state.books, state.currentBookId],
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ books: state.books, currentBookId: state.currentBookId }),
      );
    } catch {
      setState((value) =>
        value.notice
          ? value
          : { ...value, notice: "本地存储不可用，本次修改不会保留" },
      );
    }
  }, [state.books, state.currentBookId]);

  const selectBook = (id: string): void => {
    setState((value) => {
      if (!value.books.some((book) => book.id === id)) return value;
      const now = new Date().toISOString();
      return {
        ...value,
        currentBookId: id,
        books: value.books.map((book) =>
          book.id === id ? { ...book, lastReadAt: now } : book,
        ),
      };
    });
  };

  const removeBook = (id: string): void => {
    setState((value) => ({
      ...value,
      books: value.books.filter((book) => book.id !== id),
      currentBookId: value.currentBookId === id ? null : value.currentBookId,
    }));
  };

  const importBook = (file: Pick<File, "name">): LocalBook => {
    const book = createImportedBook(file);
    if (state.books.some((item) => item.id === book.id)) {
      throw new Error("这本图书已经存在");
    }
    setState((value) => ({
      ...value,
      books: [book, ...value.books],
      currentBookId: book.id,
    }));
    return book;
  };

  const clearNotice = (): void => setState((value) => ({ ...value, notice: "" }));

  return {
    ...state,
    currentBook,
    selectBook,
    removeBook,
    importBook,
    clearNotice,
  };
}

export type LibraryController = ReturnType<typeof useLibrary>;
