# EPUB Test Fixtures

This directory documents the EPUB fixture variants used for integration testing.

**Binary files are NOT committed.** Generate them locally by running:

```bash
cd prototype
node scripts/generate-epub-fixtures.mjs
# Output: /tmp/scope-reader-epub-fixtures/*.epub
```

## Fixture Variants

| File | Description | Expected behavior |
|------|-------------|-------------------|
| `epub2-ncx.epub` | EPUB 2 with NCX navigation (no EPUB 3 nav) | Parses NCX table of contents |
| `epub3-nav.epub` | EPUB 3 with EPUB 3 nav document | Reads nav toc, shows first chapter |
| `fixed-layout.epub` | EPUB 3 fixed-layout (`rendition:layout=pre-paginated`) | Triggers `UNSUPPORTED_FIXED_LAYOUT` blocking issue |
| `script-required.epub` | EPUB 3 with `properties="scripted"` on spine item | Triggers `UNSUPPORTED_SCRIPT_REQUIRED` blocking issue |
| `encrypted.epub` | EPUB 3 with unknown encryption algorithm in `META-INF/encryption.xml` | Triggers `UNSUPPORTED_ENCRYPTION` blocking issue |
| `multi-error.epub` | Fixed-layout + scripted + encrypted combined | All three blocking issues reported simultaneously |

## Structure Details

All fixtures include: `mimetype` (uncompressed), `META-INF/container.xml`, `OPS/package.opf`, `OPS/chapter.xhtml`.

- EPUB 2: adds `OPS/toc.ncx` (NCX format), no nav document
- EPUB 3: adds `OPS/nav.xhtml` (EPUB 3 nav format)
- encrypted: adds `META-INF/encryption.xml` with unknown algorithm URI

## Generator Script

`prototype/scripts/generate-epub-fixtures.mjs` uses `fflate.zipSync` to build valid ZIP archives. It outputs SHA-256 for each file so results are reproducible and verifiable.
