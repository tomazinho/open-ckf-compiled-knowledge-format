# Pipeline Robustness

**Paper:** *When the Compiler Is Correct but the Package Is Shallow: Evidence on PDF Extraction, Chunking Granularity, LLM Choice, and Observability in the CKF Compiler v1.1*

This paper studies how upstream pipeline decisions affect CKF compilation quality, especially PDF extraction, chunking strategy, source segmentation, model choice, and pipeline observability.

## Why this matters for CKF

CKF quality is not determined only by the language model or compiler prompt. It is shaped by the full ingestion and compilation chain: document extraction, paragraph preservation, chunk size, ordering, segmentation, compiler passes, traceability, and interface diagnostics.

This study shows that a compiler can be logically correct while still producing shallow packages if the input structure is degraded before compilation.

## Files

- [`paper-04.pdf`](./paper-04.pdf)

## Status

Operational robustness and observability study.
