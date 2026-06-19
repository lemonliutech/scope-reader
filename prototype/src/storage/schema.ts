import type { DBSchema } from "idb";
import type { BookMetadata, PublicationInspection, PublicationLocation, ReaderPreferences } from "../domain/publication";

export type StoredBook = {
  bookId: string;
  sha256: string;
  blob: ArrayBuffer;
  fileName: string;
  size: number;
  importedAt: string;
  lastOpenedAt: string | null;
};

export type StoredPublication = {
  bookId: string;
  format: "EPUB";
  engineVersion: string;
  inspection: PublicationInspection;
};

export type StoredReadingState = {
  bookId: string;
  location: PublicationLocation;
  updatedAt: string;
};

export type StoredPreferences = {
  scope: string;
  preferences: ReaderPreferences;
};

export type ImportRecord = {
  book: StoredBook;
  publication: StoredPublication;
  readingState: StoredReadingState;
};

export type LibraryBook = {
  bookId: string;
  fileName: string;
  size: number;
  metadata: BookMetadata;
  location: PublicationLocation;
  importedAt: string;
  lastOpenedAt: string | null;
  temporary: boolean;
};

export type StoredBookBundle = {
  book: StoredBook;
  publication: StoredPublication;
  readingState: StoredReadingState;
  preferences: StoredPreferences | null;
};

export interface ScopeReaderDb extends DBSchema {
  books: { key: string; value: StoredBook };
  publications: { key: string; value: StoredPublication };
  readingStates: { key: string; value: StoredReadingState };
  preferences: { key: string; value: StoredPreferences };
}

export interface LibraryRepository {
  importBook(input: ImportRecord): Promise<void>;
  listBooks(): Promise<LibraryBook[]>;
  loadBook(bookId: string): Promise<StoredBookBundle | null>;
  saveReadingState(state: StoredReadingState): Promise<void>;
  deleteBook(bookId: string): Promise<void>;
}
