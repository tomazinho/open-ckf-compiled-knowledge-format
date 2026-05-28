# Annotator Guidelines

Annotators should judge whether the answer follows the relations in the provided benchmark context.

## Steps

1. Check whether all necessary fragments listed in `controls.necessary_fragments` are present.
2. Check local legibility using `local_probes`.
3. Identify the required relation type: exception, override, scope, precondition, sequence, contraindication, temporal dependency, or exception of exception.
4. Compare the answer to `gold_answer.minimal` and `gold_answer.required_relations`.
5. Assign one primary failure label if incorrect.

## Adapted-real source warning

For cases `21`-`40`, do not use external professional knowledge to override the benchmark context. The source URL is provided for provenance and audit, but scoring should use the benchmark case text unless the experiment explicitly evaluates live retrieval.
