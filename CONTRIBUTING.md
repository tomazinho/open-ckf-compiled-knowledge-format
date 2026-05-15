# Contributing to Open KCP

Thanks for your interest! Open KCP is the open-source reference implementation of the Knowledge Context Protocol. The goal is to keep it **small, dependency-light, and 100% client-side**.

## Ground rules

1. **No backend.** No Supabase, no server functions, no auth, no telemetry. Anything that needs a server belongs in a different project.
2. **BYOK only.** Never bundle a vendor key. Never proxy through a hosted gateway by default.
3. **Stay framework-honest.** TanStack Start file routes only. No `src/pages/`, no React Router DOM.
4. **Keep dependencies lean.** Justify every new package in the PR description.
5. **i18n parity.** Every user-facing string must exist in both `en` and `pt-BR` dictionaries.
6. **Light + dark.** Test both themes on every UI change.

## Dev setup

```bash
bun install
bun dev
```

Build:

```bash
bun run build
```

## Project structure

See the README for a tour. The two non-obvious areas are:

- `src/lib/compiler/` — the chunk → map → reduce LLM pipeline used by Compiler Pro. The system prompt and JSON schema live in `schema.ts`. Provider adapters live in `providers.ts`.
- `src/lib/kcp/compile.ts` — the deterministic heuristic compiler used by the Demo. No network calls.

## Adding a provider

1. Add an entry to `PROVIDER_MANIFEST`, `KEY_REGEX`, and `PROVIDER_IDS` in `src/lib/compiler/providers-manifest.ts`.
2. Add a branch in `callProvider` in `src/lib/compiler/providers.ts`.
3. Verify it returns a structured tool/function call. Document any CORS quirks in the manifest's `corsNote`.
4. Update the README provider table.

## PRs

- Small, focused, with a clear title.
- Include a screenshot for any UI change.
- Run `bun run build` before opening.

## Code of conduct

Be kind. Assume good faith. No harassment.
