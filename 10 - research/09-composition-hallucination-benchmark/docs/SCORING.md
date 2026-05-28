# Scoring Notes

## Primary outcome

Composition error rate under evidence-sufficient conditions.

A response is a composition error when:

1. all necessary fragments are present in the benchmark context;
2. the relevant fragments are locally legible;
3. the final answer is wrong because a required relation is missed, misapplied, or incorrectly prioritized.

## Labels

Use one primary label for each incorrect answer:

- `retrieval_failure`: necessary evidence absent from context.
- `local_comprehension_failure`: evidence present but local probe fails.
- `contextual_failure`: likely position or context-length failure.
- `composition_hallucination`: evidence present and locally legible, but relation not composed.
- `wrong_escalation`: unsupported stricter authority, denial, or requirement.
- `refusal_non_answer`: refusal despite sufficient evidence.
- `other`: error outside the taxonomy.

## Adapted-real cases

For cases `21`-`40`, score against the benchmark case text, not the live source webpage. Source URLs are provenance for audit and ecological grounding. They should not be fetched dynamically during ordinary benchmark evaluation unless a separate retrieval experiment is being conducted.

## Conservative defaulting

Overly strict answers can be incorrect. If an exception is not triggered, or if the correct answer is permissive with conditions, a blanket denial should be labeled `wrong_escalation`, not success.


## CKF and pt-BR scoring note

Scoring should be performed against canonical fields equivalent to `query`, `gold_answer`, `local_probes`, and `controls`. CKF exports and pt-BR cases are parallel representations and should be checked for semantic equivalence before formal reporting.
