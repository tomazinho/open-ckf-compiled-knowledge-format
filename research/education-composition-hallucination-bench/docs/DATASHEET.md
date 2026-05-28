# Datasheet

## Motivation

This dataset evaluates composition hallucination in education-specific knowledge, where correct answers often require composing relations among fragments: scope, precondition, sequence, exception, override, contraindication, and temporal dependency.

## Composition

- Total cases: 20
- Language: pt-BR
- Source status: adapted from author-provided books
- Representation conditions: raw, annotated, compiled
- CKF experimental representations: included

## Distribution

```json
{
  "dataset_name": "education-composition-hallucination-bench",
  "version": "0.1.0-draft",
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
  "notes": "20 adapted education cases based on two Paulo Tomazinho books. No runner script included."
}
```

## Collection and adaptation

The cases were derived by paraphrasing and condensing pedagogical principles from the two source books into self-contained benchmark items. They are not verbatim excerpts and should not be used as replacements for the books.

## Recommended evaluation

Run each case under evidence-sufficient conditions. For each model answer, first check local probes, then score the composed query. Label errors using the categories in `docs/SCORING.md`.

## Limitations

The benchmark is draft-quality and should be reviewed by the author before public release. It is designed for evaluation, not as professional educational policy or individualized pedagogical advice.
