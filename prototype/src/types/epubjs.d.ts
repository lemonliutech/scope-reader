declare module "epubjs" {
  export type EpubNavItem = {
    id?: string;
    href: string;
    label: string;
    subitems: EpubNavItem[];
  };

  export type EpubMetadata = {
    title?: string;
    creator?: string;
    language?: string;
    description?: string;
  };

  export type EpubSection = {
    idref: string;
    href: string;
    linear: boolean;
    render(request?: (url: string) => Promise<unknown>): Promise<string>;
  };

  export type EpubBook = {
    ready: Promise<unknown>;
    loaded: {
      metadata: Promise<EpubMetadata>;
      navigation: Promise<{ toc: EpubNavItem[] }>;
      cover: Promise<string | null>;
      spine: Promise<unknown>;
    };
    spine: {
      spineItems: EpubSection[];
      get(target?: string): EpubSection | null;
    };
    load(path: string): Promise<unknown>;
    coverUrl(): Promise<string | null>;
    destroy(): void;
  };

  export default function ePub(
    input: ArrayBuffer,
    options?: { openAs?: string; replacements?: "blobUrl" | "base64" | "none" },
  ): EpubBook;
}
