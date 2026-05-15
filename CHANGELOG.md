# Changelog

All notable changes to this project will be documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-05-15

**Renamed to Compiled Knowledge Format (CKF).** The protocol-themed branding
("Knowledge Context Protocol", "KCP") has been retired in favor of a more
technical, format-oriented identity.

### Breaking changes
- **File extension:** packages are now emitted as `.ckf` (was `.kcp`). The
  Viewer accepts `.ckf`, `.json`, `.yaml`, `.md`. Legacy `.kcp` files are not
  loaded — re-export from the original source if needed.
- **Public symbols renamed:** `KcpPackage` → `CkfPackage`, `KcpMetadata` →
  `CkfMetadata`, `KcpFormat` → `CkfFormat`, `compileKcp` → `compileCkf`,
  `parseKcp` → `parseCkf`, `compileToKcp` → `compileToCkf`. All `KCP_*`
  constants (`KCP_TOOL_NAME`, `KCP_SYSTEM_PROMPT`, `KCP_PARTIAL_SCHEMA`,
  `KCP_TOOL_DESCRIPTION`) became `CKF_*`.
- **Module path:** `@/lib/kcp/*` moved to `@/lib/ckf/*`.
- **Storage keys:** `openkcp-theme`, `openkcp-lang`, `openkcp.jobs.v1`,
  `openkcp.byok.v1` → `openckf-*`. **Migration is automatic** on first load
  (legacy keys are read once, copied to the new keys, then removed). No data
  loss for existing users.
- **Domain:** `knowledgecontextprotocol.org` references replaced with
  `compiledknowledgeformat.org`. Open CKF is now served at
  `open.compiledknowledgeformat.org`.
- **Repository:** moved to `tomazinho/open-ckf-compiled-knowledge-format`
  (GitHub keeps the old URL as a redirect).

### Changed
- All UI strings (PT-BR + EN) rewritten to drop "protocol" / "context"
  language in favor of "format" / "compiled knowledge".
- Markdown export header now reads `# CKF — COMPILED KNOWLEDGE FORMAT
  PACKAGE` and uses `format_version` instead of `protocol_version`.
- LLM tool name renamed: `emit_kcp_partial` → `emit_ckf_partial`.
- Site title, description, OpenGraph, Twitter cards, and JSON-LD updated
  across all routes.

### Migration guide
- Existing browser data (theme, language, job history, BYOK keys) is migrated
  automatically on first visit — no action required.
- If you import the library from another project, find/replace
  `@/lib/kcp/` → `@/lib/ckf/`, `Kcp` → `Ckf` in type imports, and `KCP_` →
  `CKF_` in constants.
- Re-generate any cached `.kcp` files as `.ckf` from their source.

---

## [0.1.0] — 2026-05-15

Initial public release of Open KCP — the standalone, open-source reference
implementation of the Knowledge Context Protocol compiler and viewer.

### Added
- Landing page with hero, three-card overview, and link to the official protocol site.
- **Compiler Pro** route (`/compiler`) — fully client-side BYOK pipeline:
  - Five providers: OpenAI, Anthropic, Gemini, DeepSeek, OpenRouter.
  - Direct browser calls (no proxy by default).
  - Semantic chunker, structured tool/function-call extraction, map-reduce merger.
  - Per-chunk progress, ping/health check, key persistence (session or browser).
  - Output as Markdown, JSON, or compilation report.
- **Compiler Demo** route (`/compiler-demo`) — deterministic, no-key heuristic compiler producing a 22-section `.kcp` package locally.
- **Viewer** route (`/viewer`) — drag-and-drop inspector for `.kcp` / `.json` / `.yaml` / `.md` exports, with section navigation, full-text search, and source-traceability highlighting when the original file is linked.
- Local job history in `localStorage` with JSON export/import.
- File ingestion for `.txt`, `.md`, `.pdf` (pdfjs), `.docx` (mammoth) — all in-browser.
- PT-BR / EN i18n with header toggle and `navigator.language` detection.
- Light / dark themes with system preference detection.
- README, LICENSE (MIT), CONTRIBUTING, this CHANGELOG.

### Removed (vs. the parent project)
- All Supabase imports and server functions.
- Authentication, allowlist, and the Lovable AI Gateway provider.
- Lab, news, community, and admin surfaces.
