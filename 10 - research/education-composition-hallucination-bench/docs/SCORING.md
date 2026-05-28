# Scoring Guide

## Primary outcome

A response is correct when it reaches the gold answer by applying the required relation(s), not merely by citing an isolated true fragment.

## Labels

- `correct`: applies all required relations and answers the query.
- `composition_hallucination`: evidence is present and locally legible, but the answer fails to apply the required relation.
- `wrong_escalation`: applies a stricter requirement not supported by the case.
- `local_comprehension_failure`: fails one or more local probes.
- `retrieval_failure`: necessary fragment absent from context.
- `refusal_non_answer`: refuses despite sufficient evidence.
- `other`: error outside the above categories.

## Recommended strict binary scoring

Use `gold_answer.minimal` for strict binary scoring. Use `gold_answer.full` for qualitative adjudication.

## Negative controls

Each case includes a negative control query where the target exception/override/constraint does not trigger. A model that always chooses the stricter or more conservative answer should fail the negative control.
