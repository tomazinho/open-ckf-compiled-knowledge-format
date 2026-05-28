# Education Composition Hallucination Bench

**Version:** 0.1.1-draft  
**Language:** pt-BR  
**Cases:** 20  
**Status:** draft for author review

This repository contains a domain-specific benchmark for **composition hallucination in education**. The cases are adapted from two Paulo Tomazinho educational books:

1. *Avaliação Sem Mistério: como usar Rúbricas, avaliação formativa e feedbacks para transformar ensino em aprendizagem*.
2. *Orientações Baseadas no Cérebro para Transformar Ensino em Aprendizagem*.

The benchmark follows the composition-hallucination protocol: each case includes evidence sufficiency metadata, local-legibility probes, relation-sensitive gold answers, failure-mode examples, negative controls, and three matched representation conditions:

- `raw`: natural prose with implicit relations;
- `annotated`: the same content with lightweight relation tags;
- `compiled`: a structured YAML-like representation.

A parallel CKF-compatible experimental representation is included under `ckf/cases/`.

## Dataset structure

```text
education-composition-hallucination-bench/
  README.md
  LICENSE
  CITATION.cff
  MANIFEST.json
  dataset_infos.json
  cases/
    01_...json
    ...
    20_...json
  data/
    cases.jsonl
    case_index.csv
    dataset_summary.json
  schema/
    case_schema.json
  ckf/
    README.md
    ckf_schema_mapping.md
    cases/
      01_...ckf.json
      ...
      20_...ckf.json
  docs/
    DATASHEET.md
    SCORING.md
    ANNOTATOR_GUIDELINES.md
    SOURCE_PROVENANCE.md
    CONTENT_EQUIVALENCE_AUDIT.md
    CASE_PLAN.md
```


## Compatibility with the generic Python runner

This education dataset is intentionally compatible with the generic runner/scorer expected for the main `composition-hallucination-bench`, even though no Python runner is included in this draft.

Compatibility assumptions:

- the runner accepts a dataset root path as a parameter;
- the runner can read either `cases/*.json` or `data/cases.jsonl`;
- the runner validates cases against the local `schema/case_schema.json`;
- the runner uses the canonical benchmark fields rather than hard-coded case IDs or English-only labels.

The canonical case contract is the same as the main benchmark:

```text
case_id
metadata
representations.raw
representations.annotated
representations.compiled
query
gold_answer.full
gold_answer.minimal
gold_answer.required_relations
local_probes[]
failure_examples
controls
provenance
```

Runner notes:

- Use `cases/` or `data/cases.jsonl` as the official benchmark input.
- Use `schema/case_schema.json` for validation.
- Set prompts, judge instructions, and answer-normalization logic to `pt-BR`.
- If the runner uses semantic judging or relation-based scoring, it should work without structural changes.
- If the runner uses English-only exact string matching, English-specific regexes, or English judge prompts, those parts must be localized before scoring this dataset.
- Do not use `ckf/cases/` as runner input unless the runner explicitly supports CKF-style exports; `ckf/` is an experimental parallel representation, not the canonical benchmark source.

In short: the same Python runner can be reused for this dataset if it is dataset-path configurable and language configurable.

## Distribution

```json
{
  "dataset_name": "education-composition-hallucination-bench",
  "version": "0.1.1-draft",
  "language": "pt-BR",
  "total_cases": 20,
  "by_complexity_level": {
    "1": 6,
    "2": 8,
    "3": 6
  },
  "by_relation_type": {
    "contraindication": 3,
    "scope": 2,
    "precondition": 6,
    "temporal_dependency": 1,
    "override": 2,
    "sequence": 5,
    "exception": 1
  },
  "by_source_title": {
    "Avaliação Sem Mistério": 9,
    "Orientações Baseadas no Cérebro para Transformar Ensino em Aprendizagem": 11
  },
  "source_status": {
    "adapted": 20
  },
  "created": "2026-05-28",
  "notes": "20 adapted education cases based on two Paulo Tomazinho books. No runner script included; compatible with the generic composition-hallucination benchmark runner when configured for pt-BR."
}
```

## Intended use

Use this dataset to evaluate whether RAG systems and LLM agents correctly compose educational guidance involving:

- formative assessment;
- rubrics;
- evidence of learning;
- feedback;
- replanning;
- attention;
- memory consolidation;
- emotional safety;
- relevance;
- social interaction;
- flow;
- prior knowledge.

## License

Benchmark case adaptations are marked as CC-BY-4.0 for draft publication. The source books are not included in this repository and remain copyright Paulo Tomazinho. Confirm the final licensing statement before public release.

## Script status

No Python runner script is included in this draft.
