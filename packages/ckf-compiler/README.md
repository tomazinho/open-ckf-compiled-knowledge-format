# Open CKF Compiler — Standalone

Compile raw text (specs, articles, transcripts, manuals, FAQs, API docs, legal norms, lecture notes — any text-bearing source, in any domain and any language) into a **Compiled Knowledge Format (CKF) v0.2** package. Runs entirely in your browser.

Compiler engine: **v1.2** · Protocol: **ckf-1.0**

## What's new in v1.2 (domain-agnostic)

- **Preflight (`profileSource`)** — detects language, format (`jsonl_records`, `json_array_records`, `markdown`, `faq`, `legal_norm`, `transcript`, `plain_text`, …) and record count BEFORE the LLM call. Blocks degenerate inputs (filename/hash-only) and locks the target language so PT-BR sources never get silently labelled as English (and vice-versa for any language pair).
- **Segmentation (`segmentSource`)** — emits one `SourceSpan` per logical record/section with stable `s_NNN` ids, line/char offsets, SHA-256 fingerprints, and `source_record_id` propagation (e.g. JSONL `_id`, legal `Art. N`, FAQ question).
- **Coverage modes** — `summary` (LLM-only), `balanced` (top-up retrieval/atomic floor), `complete` (schema-stable per-span retrieval + QA + atomic insertion). Default depends on the detected format.
- **Numeric guards (`numericGuards`)** — generic, multi-currency / multi-locale extraction of money, percent, date, time, duration, citation references (DOI / ISBN / RFC / ISO / § / Section / Chapter / Art. / Lei / Decreto), with auto-repair of truncated prefixes (`"$1,250"` → `"$1,250,000.00"`, `"R$ 200"` → `"R$ 200.000,00"`). No domain-specific rules.
- **Sanitizer language recovery** — when >20% of rejects are `language_mismatch` and preflight strongly disagrees with the LLM's declared `metadata.language`, the metadata is corrected and the sanitizer re-runs once. Works in any direction (pt ↔ en ↔ es).
- **Richer traceability** — every extracted item carries `source_record_id`, `source_path`, `source_line_start/end`, `source_char_start/end`, `source_basis`, `confidence`.

All v1.2 modules are **domain-agnostic** by design. Examples shipped in the repo span English API docs, Portuguese-language educational prose, English SaaS FAQs, and European-currency pricing.

## Two modes

- **Heuristic** — pure regex + structural rules. No API key, no network, instant. Great for a first pass or fully offline use.
- **BYOK LLM** — bring your own API key for OpenAI, Anthropic, Google Gemini, DeepSeek, or OpenRouter. Your key stays in `localStorage`; the request goes **directly** from your browser to the provider (no proxy, no logging).

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # → dist/
npm run preview      # serve the built bundle
```

## Programmatic use

```ts
import { profileSource } from "./lib/compiler/sourceProfiler";
import { segmentSource, buildSourceManifest } from "./lib/compiler/sourceSegmenter";
import { runCkfPipeline } from "./lib/compiler/pipeline";

const profile = profileSource(rawText);
if (profile.blocked) throw new Error(profile.blockedReason);

const spans = await segmentSource(rawText, profile);
const sourceManifest = buildSourceManifest(spans);

const result = runCkfPipeline(partials, {
  chunks,                 // ChunkRef[]
  spans,                  // v1.2
  sourceManifest,         // v1.2
  profile,                // v1.2
  coverageMode: "balanced", // "summary" | "balanced" | "complete"
  sourceText: rawText,
});

console.log(result.pkg);              // CKF v0.2 package
console.log(result.quality);          // readability + AI-utility
console.log(result.coverage);         // v1.2 coverage report
console.log(result.numericIntegrity); // v1.2 numeric integrity
```

## Hosting

The build is a static SPA. Serve `dist/` from anywhere:

- **GitHub Pages** — `.github/workflows/deploy.yml` is included.
- **Netlify / Vercel / Cloudflare Pages** — drag `dist/` into the dashboard.
- **S3 / nginx** — `aws s3 sync dist/ s3://your-bucket`.
- **Local file** — open `dist/index.html` directly (works because `base: "./"`).

## BYOK — where do I get keys?

| Provider | Where | Notes |
|---|---|---|
| OpenAI | platform.openai.com/api-keys | `sk-...` |
| Anthropic | console.anthropic.com | `sk-ant-...` — direct-browser CORS is enabled by the included header |
| Google Gemini | aistudio.google.com/apikey | Free tier available |
| DeepSeek | platform.deepseek.com | Very cheap |
| OpenRouter | openrouter.ai/keys | One key, all models |

Keys are stored under `localStorage["ckf-byok-<provider>"]` and never leave your machine except to the chosen provider's official API.

## Limitations vs the hosted site

- No Advanced AI free (requires login gateway — allowlist).
- No compile history (each run is in-memory).
- No rate limiting (your provider does that).

## License

MIT.
