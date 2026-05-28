# Prompt Skeletons

## Standard composition prompt

```text
You are answering using only the provided source material.
First identify the applicable rule, exception, scope, preconditions, contraindications, temporal dependencies, and sequence requirements.
Then answer the user question.
Cite the source fragments that support the answer.
If the source material is insufficient, say so.
```

## Minimal answer prompt

```text
Using only the provided benchmark context, answer the question in one paragraph.
Do not use outside knowledge.
```

## Local probe prompt

```text
Using only the specified fragment, answer the local probe.
Do not infer from other fragments.
```
