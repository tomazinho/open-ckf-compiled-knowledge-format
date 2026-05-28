# Baseline Format vs Semantic Preservation

**Paper:** *From Narrative Documents to Compiled Knowledge: A Case Study of Knowledge Preservation Across PDF, JSON, Markdown and YAML CKF Representations*

This paper motivates the need for a compiler by showing that simply converting knowledge into JSON, YAML, Markdown, or another structured syntax does not guarantee semantic preservation.

## Why this matters for CKF

CKF is not only a file format. It is a compiled representation of operational knowledge. The goal is to preserve relations, rules, scopes, exceptions, procedures, and traceability, not merely to serialize text into a structured container.

This study provides the negative baseline that makes CKF compiler design necessary: structured outputs can be machine-readable while still being semantically shallow.

## Files

- [`paper-02.pdf`](./paper-02.pdf)

## Status

Empirical case study and software artifact analysis.
