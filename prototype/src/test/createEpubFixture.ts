import { strToU8, zipSync, type Zippable } from "fflate";

export type EpubFixtureOptions = {
  title?: string;
  author?: string;
  fixedLayout?: boolean;
  scripted?: boolean;
  encrypted?: boolean;
  omitContainer?: boolean;
  emptySpine?: boolean;
  mimetypeNotFirst?: boolean;
};

export function createEpubFixture(options: EpubFixtureOptions = {}): Uint8Array {
  const title = options.title ?? "Scope Test Book";
  const author = options.author ?? "Scope Author";
  const layoutMetadata = options.fixedLayout
    ? '<meta property="rendition:layout">pre-paginated</meta>'
    : "";
  const scriptedProperty = options.scripted ? ' properties="scripted"' : "";
  const spine = options.emptySpine ? "" : '<itemref idref="chapter" />';
  const files: Zippable = {
    ...(options.mimetypeNotFirst ? { "META-INF/": new Uint8Array() } : {}),
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "OPS/package.opf": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:scope-test-book</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:language>zh-CN</dc:language>
    ${layoutMetadata}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
    <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"${scriptedProperty} />
  </manifest>
  <spine>${spine}</spine>
</package>`),
    "OPS/nav.xhtml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head><title>目录</title></head>
  <body><nav epub:type="toc"><ol><li><a href="chapter.xhtml#start">第一章</a></li></ol></nav></body>
</html>`),
    "OPS/chapter.xhtml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>第一章</title></head><body><h1 id="start">开始</h1></body></html>`),
  };

  if (!options.omitContainer) {
    files["META-INF/container.xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml" /></rootfiles>
</container>`);
  }

  if (options.encrypted) {
    files["META-INF/encryption.xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
  <enc:EncryptedData><enc:EncryptionMethod Algorithm="urn:scope:unknown-encryption" /></enc:EncryptedData>
</encryption>`);
  }

  return zipSync(files);
}
