# Composition Hallucination in Retrieval-Augmented Generation

**Paper:** *Composition Hallucination in Retrieval-Augmented Generation: A Failure Mode and Benchmark Protocol*

This paper defines **composition hallucination**: a retrieval-augmented generation failure mode in which all necessary evidence is present and locally interpretable, but the model answers incorrectly because it fails to compose implicit relations among fragments, such as exceptions, scopes, preconditions, precedence, temporal dependencies, or procedural order.

## Why this matters for CKF

Open CKF is motivated by the idea that retrieved text is not yet operational knowledge. Knowledge requires explicit relations. When relations remain implicit in prose, even a context that contains the right fragments may not be enough.

This paper provides the methodological foundation for evaluating that problem.

## Files

- [`paper.pdf`](./paper.pdf)
- [`paper.tex`](./paper.tex)

## External record

- Zenodo: https://zenodo.org/records/20416511

## Citation

Tomazinho, Paulo. *Composition Hallucination in Retrieval-Augmented Generation: A Failure Mode and Benchmark Protocol*. Zenodo, 2026. https://zenodo.org/records/20416511
