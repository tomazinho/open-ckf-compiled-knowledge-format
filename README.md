# Open KCP

> Open-source reference implementation of the **Knowledge Context Protocol** — compile any document into a structured `.kcp` package, 100% in your browser, BYOK.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-v0.1.0-violet.svg)](CHANGELOG.md)

Open KCP is a standalone, client-side application that ports the official KCP compiler and viewer from [knowledgecontextprotocol.org](https://knowledgecontextprotocol.org). It contains:

- **Compiler Pro** — an industrial pipeline (chunk → map → reduce → validate) that calls the LLM provider of your choice directly from the browser using your own API key.
- **Compiler Demo** — a deterministic, no-key heuristic compiler that produces a 22-section `.kcp` package locally.
- **Viewer** — a drag-and-drop inspector for any `.kcp` file, with section navigation, search, and source traceability.

No accounts. No servers. No telemetry. Your text and your API keys never leave your browser.

---

## Quickstart

### Remix on Lovable

Click **Remix** on the project page on [Lovable](https://lovable.dev) — you get your own copy in seconds, no setup needed.

### Clone and run locally

```bash
git clone https://github.com/tomazinho/open-kcp-knowledge-context-protocol.git
cd open-kcp
bun install     # or: npm install
bun dev         # or: npm run dev
```

The app runs at `http://localhost:5173`. To produce a static build:

```bash
bun run build
```

### Deploy

Open KCP is a static SPA — deploy the `dist/` output to any static host (Cloudflare Pages, Netlify, Vercel static, GitHub Pages, S3+CloudFront).

---

## Providers (BYOK)

All five providers are called directly from the browser. Bring your own key — keys are kept in `sessionStorage` by default, or `localStorage` if you tick *Remember*.

| Provider     | Default model              | Get a key                                                    | CORS notes                                                                 |
| ------------ | -------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| OpenAI       | `gpt-4o-mini`              | https://platform.openai.com/api-keys                          | Direct browser calls supported.                                            |
| Anthropic    | `claude-3-5-sonnet-20241022` | https://console.anthropic.com/settings/keys                  | Requires `anthropic-dangerous-direct-browser-access: true` (sent for you). |
| Google Gemini | `gemini-2.0-flash`         | https://aistudio.google.com/app/apikey                        | Direct browser calls supported.                                            |
| DeepSeek     | `deepseek-chat`            | https://platform.deepseek.com/api_keys                        | Direct browser calls supported.                                            |
| OpenRouter   | `openai/gpt-4o-mini`       | https://openrouter.ai/keys                                    | Direct browser calls supported (one key, many models).                     |

If your network blocks any of these endpoints (corporate firewalls, mobile carriers), deploy a small CORS proxy and point the base URL at it.

---

## Architecture

- **Framework:** TanStack Start (React 19 + Vite 7), file-based routing.
- **Styling:** Tailwind CSS v4 with CSS variables (light/dark).
- **i18n:** PT-BR / EN, lazy switch in the header.
- **No backend.** No Supabase, no server functions, no auth.
- **History:** stored in `localStorage`. Export/import as JSON to back up or move between browsers.

```
src/
  routes/
    index.tsx              # landing
    compiler.tsx           # Pro (BYOK)
    compiler-demo.tsx      # heuristic demo
    viewer.tsx             # .kcp inspector
  lib/
    kcp/                   # canonical types, heuristic compiler, parser, file readers
    compiler/              # client-side LLM pipeline (chunk + map + reduce)
    history/local-jobs.ts  # localStorage history
  i18n/                    # dictionaries + provider
  components/              # Header, Footer, Shell, shadcn/ui
```

---

## About the protocol

The Knowledge Context Protocol is a structured format for transforming human-oriented text into agent-ready cognition. For the full specification, manifesto, and lab, visit:

**→ [knowledgecontextprotocol.org](https://knowledgecontextprotocol.org)**

---

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). The project is intentionally minimal and dependency-light — keep it that way.

## License

[MIT](LICENSE).
