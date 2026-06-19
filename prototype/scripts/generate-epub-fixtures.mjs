#!/usr/bin/env node
/**
 * Generates EPUB test fixture files into /tmp/scope-reader-epub-fixtures/.
 * Uses fflate (already a dependency) to build minimal but structurally correct EPUBs.
 * Run: node scripts/generate-epub-fixtures.mjs
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";

const OUT_DIR = "/tmp/scope-reader-epub-fixtures";
mkdirSync(OUT_DIR, { recursive: true });

function u8(s) { return strToU8(s); }

function buildEpub({ title, author, version = "3.0", nav, ncx, fixedLayout, scripted, encrypted, emptySpine, omitContainer }) {
  const layoutMeta = fixedLayout ? '<meta property="rendition:layout">pre-paginated</meta>' : "";
  const scriptedProp = scripted ? ' properties="scripted"' : "";
  const spine = emptySpine ? "" : '<itemref idref="chapter" />';

  const files = {
    mimetype: [u8("application/epub+zip"), { level: 0 }],
    "OPS/chapter.xhtml": u8(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>${title} — 第一章</title></head>
  <body>
    <h1 id="start">${title}</h1>
    <p>这是由 generate-epub-fixtures.mjs 生成的测试章节内容。</p>
    <p>作者：${author}</p>
  </body>
</html>`),
  };

  if (nav) {
    files["OPS/nav.xhtml"] = u8(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head><title>目录</title></head>
  <body>
    <nav epub:type="toc">
      <ol>
        <li><a href="chapter.xhtml#start">第一章 开始</a></li>
      </ol>
    </nav>
  </body>
</html>`);
  }

  if (ncx) {
    files["OPS/toc.ncx"] = u8(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:scope-fixture-epub2" /></head>
  <docTitle><text>${title}</text></docTitle>
  <navMap>
    <navPoint id="np1" playOrder="1">
      <navLabel><text>第一章 开始</text></navLabel>
      <content src="chapter.xhtml#start"/>
    </navPoint>
  </navMap>
</ncx>`);
  }

  const ncxItem = ncx ? '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />' : "";
  const ncxRef = ncx ? ' toc="ncx"' : "";
  const navItem = nav ? '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />' : "";

  files["OPS/package.opf"] = u8(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="${version}" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:scope-fixture-${Date.now()}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:language>zh-CN</dc:language>
    ${layoutMeta}
  </metadata>
  <manifest>
    ${ncxItem}
    ${navItem}
    <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"${scriptedProp} />
  </manifest>
  <spine${ncxRef}>${spine}</spine>
</package>`);

  if (!omitContainer) {
    files["META-INF/container.xml"] = u8(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`);
  }

  if (encrypted) {
    files["META-INF/encryption.xml"] = u8(`<?xml version="1.0" encoding="UTF-8"?>
<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
  <enc:EncryptedData>
    <enc:EncryptionMethod Algorithm="urn:scope:unknown-drm-algorithm" />
  </enc:EncryptedData>
</encryption>`);
  }

  return zipSync(files);
}

const fixtures = [
  {
    name: "epub2-ncx.epub",
    opts: { title: "EPUB 2 NCX 样本", author: "Scope 测试", version: "2.0", ncx: true },
    desc: "EPUB 2 with NCX navigation (no EPUB 3 nav)",
  },
  {
    name: "epub3-nav.epub",
    opts: { title: "EPUB 3 Nav 样本", author: "Scope 测试", version: "3.0", nav: true },
    desc: "EPUB 3 with EPUB 3 nav document",
  },
  {
    name: "fixed-layout.epub",
    opts: { title: "固定版式样本", author: "Scope 测试", version: "3.0", nav: true, fixedLayout: true },
    desc: "EPUB 3 fixed-layout — should trigger UNSUPPORTED_FIXED_LAYOUT",
  },
  {
    name: "script-required.epub",
    opts: { title: "脚本依赖样本", author: "Scope 测试", version: "3.0", nav: true, scripted: true },
    desc: "EPUB 3 with scripted chapter property — should trigger UNSUPPORTED_SCRIPT_REQUIRED",
  },
  {
    name: "encrypted.epub",
    opts: { title: "加密样本", author: "Scope 测试", version: "3.0", nav: true, encrypted: true },
    desc: "EPUB 3 with unknown encryption — should trigger UNSUPPORTED_ENCRYPTION",
  },
  {
    name: "multi-error.epub",
    opts: { title: "多错误样本", author: "Scope 测试", version: "3.0", nav: true, fixedLayout: true, scripted: true, encrypted: true },
    desc: "EPUB 3 with fixed-layout + scripted + encryption — should trigger three distinct errors",
  },
];

for (const { name, opts, desc } of fixtures) {
  const bytes = buildEpub(opts);
  const path = join(OUT_DIR, name);
  writeFileSync(path, bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  console.log(`${name}`);
  console.log(`  desc:   ${desc}`);
  console.log(`  size:   ${bytes.byteLength} bytes`);
  console.log(`  sha256: ${sha256}`);
  console.log();
}

console.log(`Fixtures written to ${OUT_DIR}`);
