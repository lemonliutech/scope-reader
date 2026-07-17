import { unzipSync } from "fflate";
import { issue, type ScopeIssue } from "../../domain/scopeError";

const MAX_ENTRY_COUNT = 10_000;
const MAX_INPUT_SIZE = 100 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_SIZE = 500 * 1024 * 1024;
const MAX_ENTRY_UNCOMPRESSED_SIZE = 50 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;
const EPUB_MIMETYPE = "application/epub+zip";
const SUPPORTED_OBFUSCATION_ALGORITHMS = new Set([
  "http://www.idpf.org/2008/embedding",
  "http://ns.adobe.com/pdf/enc#RC",
]);

type CentralDirectoryEntry = {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
};

export type EpubPreflight = {
  packagePath: string | null;
  entries: Map<string, Uint8Array>;
  issues: ScopeIssue[];
};

export function preflightEpub(bytes: Uint8Array): EpubPreflight {
  if (bytes.byteLength > MAX_INPUT_SIZE) {
    return {
      packagePath: null,
      entries: new Map(),
      issues: [
        issue("ZIP_BOMB_SUSPECTED", "INSPECT_PUBLICATION", true, {
          reasons: ["INPUT_SIZE_LIMIT"],
        }),
      ],
    };
  }

  let directory: CentralDirectoryEntry[];
  try {
    directory = readCentralDirectory(bytes);
  } catch (error) {
    return {
      packagePath: null,
      entries: new Map(),
      issues: [issue("ZIP_INVALID", "INSPECT_PUBLICATION", true, errorDetails(error))],
    };
  }

  const issues: ScopeIssue[] = [];
  const mimetypeStructureValid = inspectMimetypeDirectory(directory, issues);
  const unsafeReasons = inspectArchiveLimits(directory);
  if (unsafeReasons.length > 0) {
    issues.push(issue("ZIP_BOMB_SUSPECTED", "INSPECT_PUBLICATION", true, { reasons: unsafeReasons }));
    return { packagePath: null, entries: new Map(), issues };
  }

  let entries: Map<string, Uint8Array>;
  try {
    entries = new Map(Object.entries(unzipSync(bytes)));
  } catch (error) {
    return {
      packagePath: null,
      entries: new Map(),
      issues: [...issues, issue("ZIP_INVALID", "INSPECT_PUBLICATION", true, errorDetails(error))],
    };
  }

  if (mimetypeStructureValid) inspectMimetypeContent(entries, issues);
  const packagePath = inspectContainer(entries, issues);
  if (packagePath !== null) {
    inspectPackage(packagePath, entries, issues);
  }
  inspectEncryption(entries, issues);

  return { packagePath, entries, issues };
}

function readCentralDirectory(bytes: Uint8Array): CentralDirectoryEntry[] {
  if (bytes.byteLength < 22) throw new Error("ZIP end record is missing");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEndOfCentralDirectory(view);
  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const centralDirectoryDisk = view.getUint16(eocdOffset + 6, true);
  const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const directorySize = view.getUint32(eocdOffset + 12, true);
  const directoryOffset = view.getUint32(eocdOffset + 16, true);
  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== totalEntries) {
    throw new Error("Multi-disk ZIP is unsupported");
  }
  if (directoryOffset + directorySize > eocdOffset) throw new Error("Central directory is out of bounds");

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const result: CentralDirectoryEntry[] = [];
  let cursor = directoryOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > eocdOffset || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error("Central directory entry is invalid");
    }
    const compressionMethod = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const nextCursor = cursor + 46 + nameLength + extraLength + commentLength;
    if (nextCursor > eocdOffset) throw new Error("Central directory name is out of bounds");
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    result.push({ name, compressedSize, uncompressedSize, compressionMethod });
    cursor = nextCursor;
  }
  if (cursor !== directoryOffset + directorySize) throw new Error("Central directory size does not match entries");
  return result;
}

function findEndOfCentralDirectory(view: DataView): number {
  const minimumOffset = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) !== 0x06054b50) continue;
    const commentLength = view.getUint16(offset + 20, true);
    if (offset + 22 + commentLength === view.byteLength) return offset;
  }
  throw new Error("ZIP end record is invalid");
}

function inspectArchiveLimits(directory: CentralDirectoryEntry[]): string[] {
  const reasons: string[] = [];
  if (directory.length > MAX_ENTRY_COUNT) reasons.push("ENTRY_COUNT_LIMIT");
  let totalSize = 0;
  const names = new Set<string>();
  for (const entry of directory) {
    totalSize += entry.uncompressedSize;
    if (!isSafePath(entry.name) || names.has(entry.name)) reasons.push(`UNSAFE_PATH:${entry.name}`);
    names.add(entry.name);
    if (entry.uncompressedSize > MAX_ENTRY_UNCOMPRESSED_SIZE) reasons.push(`ENTRY_SIZE_LIMIT:${entry.name}`);
    const ratio = entry.compressedSize === 0
      ? entry.uncompressedSize === 0 ? 0 : Number.POSITIVE_INFINITY
      : entry.uncompressedSize / entry.compressedSize;
    if (ratio > MAX_COMPRESSION_RATIO) reasons.push(`COMPRESSION_RATIO_LIMIT:${entry.name}`);
  }
  if (totalSize > MAX_TOTAL_UNCOMPRESSED_SIZE) reasons.push("TOTAL_SIZE_LIMIT");
  return reasons;
}

function isSafePath(path: string): boolean {
  if (path.length === 0 || path.includes("\\") || path.includes("\0") || path.startsWith("/")) return false;
  return !path.split("/").some((segment) => segment === ".." || segment === ".");
}

function inspectMimetypeDirectory(
  directory: CentralDirectoryEntry[],
  issues: ScopeIssue[],
): boolean {
  const directoryEntry = directory.find(({ name }) => name === "mimetype");
  if (directoryEntry === undefined) {
    issues.push(issue("MIMETYPE_MISSING", "INSPECT_PUBLICATION", true));
    return false;
  }
  // OCF requires `mimetype` to be the first ZIP entry. Some otherwise readable
  // EPUBs are packaged with directory entries before it, so tolerate ordering
  // here and validate the parts that affect identification and decoding.
  if (directoryEntry.compressionMethod !== 0) {
    issues.push(issue("MIMETYPE_INVALID", "INSPECT_PUBLICATION", true));
    return false;
  }
  return true;
}

function inspectMimetypeContent(entries: Map<string, Uint8Array>, issues: ScopeIssue[]): void {
  const content = entries.get("mimetype");
  if (content === undefined) return;
  const value = new TextDecoder().decode(content);
  if (value !== EPUB_MIMETYPE) issues.push(issue("MIMETYPE_INVALID", "INSPECT_PUBLICATION", true));
}

function inspectContainer(entries: Map<string, Uint8Array>, issues: ScopeIssue[]): string | null {
  const content = entries.get("META-INF/container.xml");
  if (content === undefined) {
    issues.push(issue("CONTAINER_XML_MISSING", "INSPECT_PUBLICATION", true));
    return null;
  }
  const document = parseXml(content);
  const rootfile = document === null
    ? undefined
    : queryLocalName(document, "rootfile").find((node) => node.hasAttribute("full-path"));
  const packagePath = rootfile?.getAttribute("full-path")?.trim();
  if (document === null || packagePath === undefined || packagePath === "" || !isSafePath(packagePath)) {
    issues.push(issue("CONTAINER_XML_INVALID", "INSPECT_PUBLICATION", true));
    return null;
  }
  if (!entries.has(packagePath)) {
    issues.push(issue("PACKAGE_DOCUMENT_MISSING", "INSPECT_PUBLICATION", true, { packagePath }));
  }
  return packagePath;
}

function inspectPackage(packagePath: string, entries: Map<string, Uint8Array>, issues: ScopeIssue[]): void {
  const content = entries.get(packagePath);
  if (content === undefined) return;
  const document = parseXml(content);
  const packageElement = document?.documentElement;
  if (document === null || packageElement?.localName !== "package") {
    issues.push(issue("PACKAGE_DOCUMENT_INVALID", "INSPECT_PUBLICATION", true));
    return;
  }
  const manifestItems = queryLocalName(document, "item");
  const manifestIds = new Set<string>();
  let manifestInvalid = false;
  for (const itemElement of manifestItems) {
    const id = itemElement.getAttribute("id")?.trim();
    const href = itemElement.getAttribute("href")?.trim();
    const mediaType = itemElement.getAttribute("media-type")?.trim();
    if (!id || !href || !mediaType || manifestIds.has(id)) manifestInvalid = true;
    if (id) manifestIds.add(id);
    if (itemElement.getAttribute("properties")?.split(/\s+/u).includes("scripted")) {
      issues.push(issue("UNSUPPORTED_SCRIPT_REQUIRED", "CHECK_CAPABILITIES", true, { id, href }));
    }
  }
  if (manifestInvalid || manifestItems.length === 0) {
    issues.push(issue("MANIFEST_INVALID", "INSPECT_PUBLICATION", true));
  }

  const spineItems = queryLocalName(document, "itemref");
  if (spineItems.length === 0) {
    issues.push(issue("SPINE_EMPTY", "INSPECT_PUBLICATION", true));
  }
  for (const spineItem of spineItems) {
    const idref = spineItem.getAttribute("idref")?.trim();
    if (!idref || !manifestIds.has(idref)) {
      issues.push(issue("SPINE_REFERENCE_MISSING", "INSPECT_PUBLICATION", true, { idref }));
    }
  }

  const fixedLayout = queryLocalName(document, "meta").some(
    (meta) => meta.getAttribute("property") === "rendition:layout" && meta.textContent?.trim() === "pre-paginated",
  );
  if (fixedLayout) issues.push(issue("UNSUPPORTED_FIXED_LAYOUT", "CHECK_CAPABILITIES", true));
}

function inspectEncryption(entries: Map<string, Uint8Array>, issues: ScopeIssue[]): void {
  const content = entries.get("META-INF/encryption.xml");
  if (content === undefined) return;
  const document = parseXml(content);
  if (document === null) {
    issues.push(issue("UNSUPPORTED_ENCRYPTION", "CHECK_CAPABILITIES", true));
    return;
  }
  const algorithms = queryLocalName(document, "EncryptionMethod")
    .map((element) => element.getAttribute("Algorithm"))
    .filter((algorithm): algorithm is string => algorithm !== null);
  if (algorithms.length === 0 || algorithms.some((algorithm) => !SUPPORTED_OBFUSCATION_ALGORITHMS.has(algorithm))) {
    issues.push(issue("UNSUPPORTED_ENCRYPTION", "CHECK_CAPABILITIES", true, { algorithms }));
  }
}

// getElementsByTagNameNS("*", name) has broken namespace wildcard support in some DOM
// implementations (e.g. happy-dom). querySelectorAll("*") + localName filter is equivalent
// and universally supported.
function queryLocalName(parent: Document | Element, localName: string): Element[] {
  return Array.from(parent.querySelectorAll("*")).filter((el) => el.localName === localName);
}

function parseXml(content: Uint8Array): XMLDocument | null {
  try {
    const document = new DOMParser().parseFromString(new TextDecoder("utf-8", { fatal: true }).decode(content), "application/xml");
    return document.getElementsByTagName("parsererror").length === 0 ? document : null;
  } catch {
    return null;
  }
}

function errorDetails(error: unknown): Record<string, unknown> {
  return { reason: error instanceof Error ? error.message : String(error) };
}
