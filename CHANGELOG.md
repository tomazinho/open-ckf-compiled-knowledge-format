# Changelog

All notable changes to this project will be documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
