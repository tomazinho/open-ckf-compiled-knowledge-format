# Annotator Guidelines

1. Read the `raw` representation first.
2. Verify that all necessary fragments listed in `controls.necessary_fragments` are present.
3. Run or inspect the `local_probes` to determine whether each fragment is locally legible.
4. Score the main query against `gold_answer.minimal`.
5. Assign exactly one primary failure label if the response is incorrect.
6. Check the negative control to detect conservative defaulting.
7. Do not reward answers that are safer but unsupported by the case.
8. Do not use external educational beliefs to override the case text.
