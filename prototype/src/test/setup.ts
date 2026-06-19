// webidl-conversions@8 (jsdom@27 dep) reads these descriptors at module load time.
// They were added in Node.js v20; polyfill them for Node.js 18 test environments.
if (!Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")) {
  Object.defineProperty(ArrayBuffer.prototype, "resizable", { get() { return false; } });
}
if (!Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "growable")) {
  Object.defineProperty(SharedArrayBuffer.prototype, "growable", { get() { return false; } });
}

// happy-dom has two XML namespace API gaps that epubjs relies on:
//
// 1. querySelector/querySelectorAll throw for namespace-aware selectors like `nav[*|type="toc"]`.
//    epubjs has its own fallback when querySelector returns null (IE compat path), so we
//    normalise the throw into null/[] to activate that path.
//
// 2. getElementsByTagNameNS always returns empty for XML documents (both wildcard `*` and
//    specific namespace URIs). epubjs uses this to read Dublin Core metadata from OPF files.
//    We fall back to querySelectorAll("*") + localName filtering, which happy-dom does support.
//
// XMLDocument has a separate prototype chain from Document in happy-dom, so patch both.

const patchSelectorMethod = (proto: object, method: "querySelector" | "querySelectorAll") => {
  const original = (proto as Record<string, unknown>)[method] as (...args: unknown[]) => unknown;
  if (typeof original !== "function") return;
  (proto as Record<string, unknown>)[method] = function (selector: string, ...rest: unknown[]) {
    try {
      return original.call(this, selector, ...rest);
    } catch {
      return method === "querySelector" ? null : [];
    }
  };
};

const patchGetElementsByTagNameNS = (proto: object) => {
  const original = (proto as Record<string, unknown>).getElementsByTagNameNS as (...args: unknown[]) => HTMLCollectionOf<Element>;
  if (typeof original !== "function") return;
  (proto as Record<string, unknown>).getElementsByTagNameNS = function (ns: string | null, localName: string) {
    const result = original.call(this, ns, localName);
    if (result.length > 0) return result;
    // happy-dom does not resolve XML namespace URIs in getElementsByTagNameNS.
    // Fall back to querySelectorAll("*") + localName filter.
    const self = this as unknown as Element & Document;
    const all = Array.from((self as Element).querySelectorAll?.("*") ?? (self as Document).querySelectorAll("*"));
    const matched = all.filter((node) => node.localName === localName);
    // Return a live-ish array-like object that satisfies length + index access
    return Object.assign(matched, { item: (i: number) => matched[i] ?? null }) as unknown as HTMLCollectionOf<Element>;
  };
};

const xmlProtos: object[] = [Element.prototype, Document.prototype];
if (typeof XMLDocument !== "undefined") xmlProtos.push(XMLDocument.prototype);
for (const proto of xmlProtos) {
  patchSelectorMethod(proto, "querySelector");
  patchSelectorMethod(proto, "querySelectorAll");
  patchGetElementsByTagNameNS(proto);
}

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);
