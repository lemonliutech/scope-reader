import type { ScopeIssue } from "./scopeError";

export type PublicationFormat = "EPUB";

export interface PublicationSource {
  fileName: string;
  mediaType: string;
  size: number;
  data: ArrayBuffer;
}

export interface BookMetadata {
  title: string;
  authors: string[];
  language: string | null;
  description: string | null;
  cover: Blob | null;
}

export interface PublicationTarget {
  format: PublicationFormat;
  locator: string;
}

export interface NavigationNode {
  id: string;
  label: string;
  target: PublicationTarget;
  children: NavigationNode[];
}

export interface ReadingOrderItem {
  id: string;
  label: string;
  target: PublicationTarget;
  linear: boolean;
}

export interface ChapterDocument {
  id: string;
  title: string;
  html: string;
  baseUrl: string;
  warnings: ScopeIssue[];
}

export interface PublicationLocation {
  format: PublicationFormat;
  locator: string;
  chapterIndex: number;
  scrollRatio: number;
}

export interface PublicationInspection {
  metadata: BookMetadata;
  navigation: NavigationNode[];
  readingOrder: ReadingOrderItem[];
  issues: ScopeIssue[];
}

export interface ReaderPreferences {
  fontSize: number;
  lineHeight: number;
  theme: "LIGHT" | "DARK";
}

export type FormatConfidence = 0 | 10 | 20 | 30 | 100;
