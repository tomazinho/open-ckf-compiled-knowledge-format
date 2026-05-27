# Research

This directory collects the research papers, benchmark protocols, technical reports, and synthesis documents behind Open CKF.

The materials are organized as a research timeline: from the motivating failure mode, through CKF compiler evolution, robustness studies, model sensitivity analyses, synthesis papers, operational applications, and legal-domain specialization.

## Research Timeline

| Phase | Folder | Focus |
|---|---|---|
| 01 | [`01-foundation-composition-hallucination`](./01-foundation-composition-hallucination) | Defines composition hallucination, the RAG failure mode that motivates CKF |
| 02 | [`02-baseline-format-semantic-preservation`](./02-baseline-format-semantic-preservation) | Shows why plain JSON/YAML are not enough for semantic preservation |
| 03 | [`03-compiler-evolution`](./03-compiler-evolution) | Documents the evolution of the CKF compiler architecture |
| 04 | [`04-pipeline-robustness`](./04-pipeline-robustness) | Studies end-to-end effects of PDF extraction, chunking, and pipeline observability |
| 05 | [`05-model-sensitivity`](./05-model-sensitivity) | Compares how different models affect CKF depth, structure, and semantic preservation |
| 06 | [`06-grand-synthesis`](./06-grand-synthesis) | Consolidates the research program and CKF's technology maturity |
| 07 | [`07-personal-knowops`](./07-personal-knowops) | Applies CKF ideas to personal knowledge operations and Obsidian workflows |
| 08 | [`08-legal-compilation`](./08-legal-compilation) | Explores legal-domain compilation for normative, article-level, compliance-oriented knowledge |

## Suggested reading order

Start with **01** to understand the failure mode, then read **02** and **03** to understand why CKF is a compiler problem rather than a serialization problem. Papers **04** and **05** cover operational robustness and model sensitivity. Paper **06** is the synthesis. Papers **07** and **08** show applied and domain-specialized directions.
