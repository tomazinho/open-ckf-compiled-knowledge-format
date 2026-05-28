# Scripts — Evaluation Runner and Utilities

This directory contains the Python tooling for the Composition Hallucination Benchmark. It is intentionally small and dependency-light: reading `run_eval.py`, `providers.py`, and `classifier.py` end-to-end takes about twenty minutes, which is deliberate — scoring logic you cannot audit is scoring logic you cannot trust.

**Authors:** CKF Research; Paulo Tomazinho.

```
scripts/
├── validate_cases.py   Validate all cases against the schema; check EN/PT/CKF parity
├── build_jsonl.py      Regenerate data/ artifacts from the canonical cases/
├── run_eval.py         Run cases against models, classify responses, aggregate
├── score_outputs.py    Re-score / re-aggregate an existing results.jsonl
├── providers.py        Anthropic / OpenAI / Google / mock adapters
├── classifier.py       Heuristic + LLM-as-judge classification
└── requirements.txt
```

## Install

Requires Python 3.10+.

```bash
pip install -r scripts/requirements.txt
```

Only `jsonschema` is strictly required (for `validate_cases.py`). The provider SDKs are imported lazily, so you only need the one(s) for the models you actually call. If you only run Anthropic models, `pip install anthropic jsonschema` is enough.

## API keys

Read from environment variables; set only what you need:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export GOOGLE_API_KEY=...        # or GEMINI_API_KEY
```

Keys are never read from files or arguments and never logged.

---

## `validate_cases.py`

Validates every file in `cases/` and `cases_pt-br/` against `schema/case_schema.json`, checks that English / Portuguese / CKF case sets are in parity, and warns if any case has fewer than two local probes.

```bash
python scripts/validate_cases.py
```

Exit code 0 on full pass, non-zero otherwise — suitable for CI.

## `build_jsonl.py`

Deterministically regenerates the derived artifacts in `data/` from the canonical per-case JSON files: `cases.jsonl`, `cases_pt-br.jsonl`, `case_index.csv`, and `dataset_summary.json`. Never hand-edit those; edit the cases and rebuild.

```bash
python scripts/build_jsonl.py --version 0.5.0
```

## `run_eval.py`

The main runner. For each (case, model, condition, query type, repetition) it builds a prompt with the source material in the chosen representation, calls the model, classifies the response, and writes a record to `results.jsonl` incrementally (so a crash loses nothing). At the end it aggregates into `summary.csv` and `report.md`.

```bash
# Offline pipeline test (no key, no cost)
python scripts/run_eval.py --models mock:no --output-dir runs/mock --yes

# Cost estimate only
python scripts/run_eval.py --models anthropic:claude-opus-4-7 --dry-run

# Full run with out-of-family judge
python scripts/run_eval.py \
    --models anthropic:claude-opus-4-7 \
    --judge-model openai:gpt-4o-2024-08-06 \
    --conditions raw annotated compiled \
    --query-types primary negative_control local_probe \
    --output-dir runs/opus-full/

# Portuguese-Brazilian cases
python scripts/run_eval.py --models anthropic:claude-opus-4-7 --lang pt-br
```

### Model specification

Models are `provider:model_id`:

| Provider | Example |
|----------|---------|
| Anthropic | `anthropic:claude-opus-4-7` |
| OpenAI | `openai:gpt-4o-2024-08-06` |
| Google | `google:gemini-2.5-pro` |
| Mock (offline) | `mock:no`, `mock:yes`, `mock:refuse`, `mock:echo` |

The model ID string is passed straight to the SDK, so new models work without code changes.

### Query types and what each controls for

- **`primary`** — the composition-requiring query. The main measurement.
- **`negative_control`** — a query where the relation does *not* trigger and the general rule should apply (protocol section 6.5). Distinguishes correct composition from conservative defaulting. A model that always escalates looks safe on exceptions while failing permissive cases.
- **`local_probe`** — each necessary fragment queried in isolation (section 7.2). If a probe fails, a primary-query failure cannot be attributed to composition. Probes are scored by keyword overlap (`probe_pass` / `probe_fail`).

Running all three lets you apply the protocol's minimal diagnostic (section 4.3): a strong composition-hallucination candidate passes the local probes, fails the primary query in `raw`, and recovers in `annotated`/`compiled`.

### Conditions and prompt styles

`--conditions raw annotated compiled` selects representations. The core comparison is `raw` vs `annotated`/`compiled`.

`--prompt-style standard` (default) uses the protocol's prompt skeleton (identify rule, exception, scope, preconditions, contraindications, temporal dependencies, sequence — then answer). `--prompt-style minimal` uses a bare prompt. Comparing the two measures how much of the gap a prompt scaffold can close on its own.

### Judge constraint (section 8.4)

`--judge-model` enables LLM-as-judge classification. The runner **refuses** a judge from the same family as any evaluated model (e.g. judging `anthropic:claude-opus-4-7` with `anthropic:claude-haiku-4-5` aborts). Judge a Claude model with GPT or Gemini, and vice versa. The judge is not ground truth; for published results, validate a sample of judge labels against human labels and report agreement.

## `score_outputs.py`

Re-scores or re-aggregates an existing `results.jsonl` without re-calling the evaluated models. Two uses:

```bash
# Add judge labels after a cheap heuristic-only run
python scripts/score_outputs.py runs/opus-full/results.jsonl \
    --judge-model openai:gpt-4o-2024-08-06

# Just re-aggregate (e.g. after hand-editing labels)
python scripts/score_outputs.py runs/opus-full/results.jsonl --aggregate-only
```

---

## Classification

Each non-probe response gets a label from this set (matching protocol section 8.3): `correct`, `composition_hallucination`, `wrong_escalation`, `refusal`, `local_comprehension_failure`, `other`.

**The heuristic classifier (always runs)** uses leading Yes/No polarity, keyword overlap with the gold minimal answer, refusal-pattern matching, and escalation-term detection. It is fast, deterministic, free, and fully auditable in `classifier.py`. It is also **deliberately conservative**: when it cannot confidently classify, it returns `other` rather than guessing. A bare "No." against a detailed gold often lands in `other`. Treat the `other` bucket as "unscored — needs the judge or a human," not as "wrong." **Do not report heuristic-only numbers as final.**

**The LLM-as-judge (optional)** is more reliable for non-binary cases (e.g. the level-3 cases with multiple sub-answers). Each record stores both labels and a `heuristic_judge_agree` flag when the judge ran, so you can compute agreement yourself.

## Output files

Everything lands in `--output-dir` (default `runs/run-<timestamp>/`):

- `results.jsonl` — one object per response: full prompt metadata, verbatim response, token counts, latency, both classifier labels. This is the source of truth.
- `summary.csv` — aggregated by `model x condition x relation_type x complexity_level x source_status`, with per-label counts plus `accuracy` and `composition_error_rate`.
- `report.md` — a human-readable accuracy table by `model x condition`.

When a judge ran, the summary uses the judge label; otherwise the heuristic label.

## Cost and resuming

The runner prints a rough cost estimate (from approximate public prices in `run_eval.py`; verify against current vendor pricing) and asks for confirmation unless `--yes` is given. A full 40-case run across all conditions, all query types, and an out-of-family judge is on the order of a few hundred to ~1,300 calls per model. If interrupted, re-run with `--resume` and the same `--output-dir` to skip completed tasks.

## Known limitations

- The heuristic classifier is conservative, not accurate. See above.
- The judge is a model, not an oracle — validate against humans for publication.
- Position controls (section 7.4) and the no-context parametric control (section 7.6) are not yet built-in query types; cases annotate `position_variants_supported` and `parametric_contamination_risk` to support manual checks. Automating these is a good contribution.
- Calls are sequential (no concurrency), which keeps rate-limit and failure behavior predictable.
