# Contributing to Open CKF

Thanks for your interest in improving Open CKF! Contributions of all sizes are
welcome — bug fixes, documentation, new benchmark cases, or app features.

This repository holds two browser-only apps plus the research materials behind
them. Everything runs without a backend.

## Repository layout

| Path | What lives here |
|---|---|
| `packages/ckf-viewer` | Browser-only viewer for `.ckf.json` packages. Vite + React + TypeScript. |
| `packages/ckf-compiler` | Browser-only compiler (heuristic offline mode + BYOK LLM mode). Vite + React + TypeScript. |
| `10 - research/` | Research papers, benchmark protocols, datasets, and Python evaluation scripts. |
| `scripts/` | Repository-level build helpers. |

## Local development (apps)

Each app is an independent Vite + React + TypeScript project with **no backend**.

```bash
cd packages/ckf-viewer   # or packages/ckf-compiler
npm install
npm run dev      # local dev server
npm run build    # static bundle in dist/
npm run preview  # serve the production build locally
```

Design constraints to preserve when changing the apps:

- **Browser-only** — no server, database, or login.
- **Privacy** — in BYOK mode the user's API key stays in the browser
  (`localStorage`) and is sent only to the provider the user selected, never to
  any other server.
- **Portability** — the built `dist/` must remain hostable on any static host
  (GitHub Pages, S3, Netlify, a VPS, or a USB stick).

## Tests

Unit tests for the compiler live next to the source in
`packages/ckf-compiler/src/lib/compiler/__tests__`. When you change compiler
logic, please add or update the relevant tests and make sure the existing ones
still pass.

## Research scripts

The composition-hallucination benchmark runner lives in
`10 - research/09-composition-hallucination-benchmark/scripts`.

```bash
pip install -r requirements.txt
python scripts/validate_cases.py        # validate the dataset against the schema
python scripts/run_eval.py --models mock:no --output-dir runs/mock --yes   # offline smoke test (no API key, no cost)
```

API keys for real runs are read from environment variables
(`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY` / `GEMINI_API_KEY`).
**Never commit API keys** — use a local `.env` (already in `.gitignore`) or your
shell environment.

## Submitting changes

1. Fork the repository and create a topic branch:
   `git checkout -b docs/short-description`.
2. Make focused commits with clear, descriptive messages.
3. Keep each pull request scoped to one logical change.
4. Open a pull request against `main`, describing **what** changed and **why**.

## License

By contributing, you agree that your contributions are licensed under the
repository's [MIT License](./LICENSE).
