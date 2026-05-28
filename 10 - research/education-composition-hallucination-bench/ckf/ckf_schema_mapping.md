# CKF Schema Mapping

The benchmark schema remains canonical. CKF files are experimental exports.

| Benchmark field | CKF section |
|---|---|
| `case_id` | `metadata.id` |
| `metadata.title` | `metadata.title` |
| `metadata.domain` / `subdomains` | `domain_map` |
| `metadata.relation_type` | `domain_map.relation_type`, `exceptions`, `decision_rules` |
| `representations.raw` | `retrieval_chunks` |
| `representations.annotated` | retained in benchmark case only |
| `representations.compiled` | retained in benchmark case only |
| `query` | `core_intent.user_task`, `qa_pairs.question` |
| `gold_answer` | `core_intent.expected_outcome`, `decision_rules`, `qa_pairs.answer` |
| `local_probes` | `atomic_units` |
| `failure_examples` | `anti_patterns` |
| `provenance` | `source_traceability` |

The CKF exports are intentionally lightweight. They are not claims of full CKF compiler conformance.
