# Open CKF

**Standalone, open-source Compiled Knowledge Format (CKF) tools.** Two browser-only apps you can host anywhere — GitHub Pages, S3, Netlify, a VPS, or even a USB stick.

This repository contains the same engine that powers [compiledknowledgeformat.org](https://compiledknowledgeformat.org), repackaged with **zero backend, zero database, zero login**.

## Downloads

[![Download Release](https://img.shields.io/badge/Download-v1.0.0-blueviolet)](https://github.com/tomazinho/open-ckf-compiled-knowledge-format/archive/refs/tags/v1.0.0.zip)

- Source ZIP: https://github.com/tomazinho/open-ckf-compiled-knowledge-format/archive/refs/tags/v1.0.0.zip
- Releases page: https://github.com/tomazinho/open-ckf-compiled-knowledge-format/releases

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
| Advanced AI free credits | Hosted site (admin allowlist) |

# Research

This directory collects the research papers, benchmark protocols, technical reports, and synthesis documents behind Open CKF.

The materials are organized as a research timeline: from the motivating failure mode, through CKF compiler evolution, robustness studies, model sensitivity analyses, synthesis papers, operational applications, and legal-domain specialization.

## Research Timeline

| Phase | Folder | Focus |
|---|---|---|
| 01 | [`01-foundation-composition-hallucination`](./01-foundation-composition-hallucination) | Defines composition hallucination, the RAG failure mode that motivates CKF |
| 02 | [`02-baseline-format-semantic-preservation`](./02-baseline-format-semantic-preservation) | Shows why plain JSON/YAML are not enough for semantic preservation |
| 03 | [`03-compiler-evolution`](./03-compiler-evolution) | Documents the evolution of the CKF compiler architecture |
| 04 | [`04-pipeline-robustness`](./04-pipeline-robustness) | Studies end-to-end effects of PDF extraction, chunking, and pipeline observability |
| 05 | [`05-model-sensitivity`](./05-model-sensitivity) | Compares how different models affect CKF depth, structure, and semantic preservation |
| 06 | [`06-grand-synthesis`](./06-grand-synthesis) | Consolidates the research program and CKF's technology maturity |
| 07 | [`07-personal-knowops`](./07-personal-knowops) | Applies CKF ideas to personal knowledge operations and Obsidian workflows |
| 08 | [`08-legal-compilation`](./08-legal-compilation) | Explores legal-domain compilation for normative, article-level, compliance-oriented knowledge |

## Research Benchmarks

- [Composition Hallucination Bench](10%20-%20research/composition-hallucination-bench)  
  A general RAG benchmark for testing whether models can compose implicit relations among retrieved fragments, such as exceptions, overrides, scope constraints, preconditions, temporal dependencies, contraindications, and procedural sequences.

- [Education Composition Hallucination Bench](10%20-%20research/education-composition-hallucination-bench)  
  A pt-BR education benchmark for testing composition hallucination in pedagogical reasoning, assessment design, formative feedback, classroom decision-making, and brain-based learning strategies.
  
## Suggested reading order

Start with **01** to understand the failure mode, then read **02** and **03** to understand why CKF is a compiler problem rather than a serialization problem. Papers **04** and **05** cover operational robustness and model sensitivity. Paper **06** is the synthesis. Papers **07** and **08** show applied and domain-specialized directions.


## License

MIT — see [LICENSE](./LICENSE).

## Contributing

Bug reports, PRs, and forks are welcome. The canonical CKF specification lives at [compiledknowledgeformat.org/docs](https://compiledknowledgeformat.org/docs).
