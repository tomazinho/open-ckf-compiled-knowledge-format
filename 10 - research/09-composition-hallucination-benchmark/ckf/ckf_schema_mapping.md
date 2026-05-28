# CKF Schema Mapping

This document explains how the canonical Composition Hallucination Benchmark case schema maps into the experimental CKF-compatible export.

## Design decision

The benchmark keeps `cases/*.json` as the canonical format because it is compact, easy to validate, and directly aligned with benchmark scoring. CKF-compatible files are generated as a parallel representation so that CKF-native systems can be evaluated without forcing all benchmark users to adopt CKF.

## Path layout

```text
cases/              canonical benchmark cases
cases_pt-br/        Portuguese-Brazilian parallel draft cases
ckf/cases/          experimental CKF-compatible exports
data/cases.jsonl    HuggingFace-ready English JSONL
data/cases_pt-br.jsonl HuggingFace-ready Portuguese-Brazilian JSONL
schema/             canonical benchmark validation schema
```

## Field mapping

| Canonical field | CKF-compatible target | Notes |
|---|---|---|
| `case_id` | `package_metadata.id` | Stable benchmark identifier. |
| `metadata.domain` | `package_metadata.domain` | Domain label preserved. |
| `metadata.relation_type` | `package_metadata.relation_type` and `knowledge_units.rules[0].type` | Relation type becomes a typed rule cue. |
| `metadata.complexity_level` | `package_metadata.complexity_level` | Preserved for stratified evaluation. |
| `provenance` | `source_traceability.provenance` | Preserved for adapted-real cases. |
| `representations.raw` | `knowledge_units.source_excerpts[id=raw]` | Raw prose condition. |
| `representations.annotated` | `knowledge_units.source_excerpts[id=annotated]` | Relation-annotated condition. |
| `representations.compiled` | `knowledge_units.compiled_representation` | YAML-like compiled condition. |
| `query` | `knowledge_units.decision_rules[0].query` | Main benchmark question. |
| `gold_answer.full` | `knowledge_units.decision_rules[0].rationale` | Full reference answer. |
| `gold_answer.minimal` | `knowledge_units.decision_rules[0].expected_decision` | Strict scoring target. |
| `local_probes` | `knowledge_units.qa_pairs` | Local legibility checks. |
| `failure_examples` | `knowledge_units.failure_modes` | Failure taxonomy examples. |
| `controls` | `knowledge_units.controls` | Retrieval, position, negative, and contamination controls. |

## Non-goals

The CKF-compatible export is not intended to replace the benchmark schema, enforce a complete CKF ontology, or claim full conformance with every CKF package type. It is a bridge format for experiments.
