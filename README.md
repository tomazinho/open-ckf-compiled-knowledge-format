# Open CKF

**Standalone, open-source Compiled Knowledge Format (CKF) tools.** Two browser-only apps you can host anywhere — GitHub Pages, S3, Netlify, a VPS, or even a USB stick.

This repository contains the same engine that powers [compiledknowledgeformat.org](https://compiledknowledgeformat.org), repackaged with **zero backend, zero database, zero login**.

## Packages

| Package | What it does | Backend? |
|---|---|---|
| [`packages/ckf-viewer`](./packages/ckf-viewer) | Drop a `.ckf.json` file and explore its sections, rules, definitions, and source traceability. | None |
| [`packages/ckf-compiler`](./packages/ckf-compiler) | Compile raw text into a CKF package. Heuristic mode runs fully offline; BYOK mode calls OpenAI / Anthropic / Google / DeepSeek / OpenRouter directly from your browser. | None — your API key stays in `localStorage` |

## Quick start

```bash
git clone https://github.com/tomazinho/open-ckf-compiled-knowledge-format
cd open-ckf-compiled-knowledge-format/packages/ckf-viewer
npm install && npm run dev
# or, in packages/ckf-compiler
```

To build a static bundle:

```bash
npm run build
# -> dist/ ready for any static host or `python -m http.server`
```

## When to use Open CKF vs the hosted site

| Need | Use |
|---|---|
| Try CKF without installing anything | [compiledknowledgeformat.org](https://compiledknowledgeformat.org) |
| Run on your own infra / behind a VPN | Open CKF |
| 100% offline / air-gapped | Open CKF (heuristic mode) |
| White-label deployment | Open CKF (MIT licensed) |
| Lovable AI free credits | Hosted site (admin allowlist) |

## License

MIT — see [LICENSE](./LICENSE).

## Contributing

Bug reports, PRs, and forks are welcome. The canonical CKF specification lives at [compiledknowledgeformat.org/docs](https://compiledknowledgeformat.org/docs).
