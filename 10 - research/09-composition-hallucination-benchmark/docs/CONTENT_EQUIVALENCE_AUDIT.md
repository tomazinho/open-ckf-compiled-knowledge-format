# Content Equivalence Audit

## Purpose

Each case has three matched representations: raw prose, relation-annotated prose, and structurally compiled representation. The benchmark requires that annotated and compiled representations make relations explicit without adding new substantive facts.

## Audit status

- Cases `01`-`20`: previously audited synthetic cases.
- Cases `21`-`40`: adapted-real cases added in `v0.3.0-draft`; author-side audit performed.

## Audit rule for cases 21–40

For each adapted-real case:

1. The `raw` representation contains every fact needed for the gold answer.
2. The `annotated` representation uses tags to mark relations already inferable from raw prose.
3. The `compiled` representation converts the same facts into typed objects.
4. Provenance metadata identifies the real source pattern, but the benchmark source of truth is the case text.

## Known residual risk

The adapted-real source documents are richer than the benchmark cases. Condensation may remove context that matters in real deployments. These cases should therefore be treated as ecological grounding for relation patterns, not authoritative summaries of the source documents.

Independent review is recommended before a formal benchmark release.
