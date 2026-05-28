# Changelog

All notable changes to this benchmark are documented here. Versions follow semantic-ish
dataset versioning; `-draft` suffixes marked pre-publication iterations.

## 0.5.0 — 2026-05-28

- Added a Python evaluation runner and utilities under `scripts/`:
  - `run_eval.py` — multi-provider runner (Anthropic, OpenAI, Google, plus an offline mock provider).
  - `score_outputs.py` — re-score / re-aggregate an existing run; add an LLM-as-judge post hoc.
  - `validate_cases.py` — schema validation plus EN/PT/CKF parity checks.
  - `build_jsonl.py` — regenerate derived `data/` artifacts from the canonical cases.
  - `providers.py`, `classifier.py` — provider adapters and heuristic + LLM-as-judge classification.
- Runner enforces the protocol's controls: retrieval held constant; primary, negative-control,
  and local-probe query types; and an out-of-family judge requirement (protocol §8.4).
- Set authorship to CKF Research and Paulo Tomazinho in `CITATION.cff`, README, README.pt-BR,
  and scripts documentation.
- Bumped version to 0.5.0 (dropped the `-draft` suffix) and regenerated `data/` artifacts,
  `dataset_summary.json`, `dataset_infos.json`, and `MANIFEST.json`.

## 0.4.0-draft — 2026-05-28

- Added `cases_pt-br/` with Portuguese-Brazilian draft translations for all 40 cases.
- Added `data/cases_pt-br.jsonl`.
- Added experimental CKF-compatible exports under `ckf/cases/` and `ckf/ckf_schema_mapping.md`.
- Updated README, README.pt-BR, dataset summary, dataset infos, case index, datasheet, and manifest.

## 0.3.0-draft — 2026-05-27

- Added 20 adapted-real benchmark cases (`21`–`40`) derived from public source documents
  (Kubernetes, AWS, DailyMed, IRS, university policies, RFCs).
- Added `provenance` metadata for adapted-real cases.
- Updated `schema/case_schema.json` with an optional `provenance` object.
- Regenerated `data/cases.jsonl`, `data/case_index.csv`, and `data/dataset_summary.json`.

## 0.2.0-draft

- Added 10 synthetic cases (`11`–`20`) across legal, clinical, regulatory, education,
  technical-operations, and eligibility domains.
- Reorganized the repository for GitHub and HuggingFace publication.
- Added JSONL, CSV index, dataset summary, datasheet, scoring notes, prompt skeletons,
  and citation metadata.

## 0.1.0-draft

- Initial synthetic bundle with 10 composition-hallucination cases.
