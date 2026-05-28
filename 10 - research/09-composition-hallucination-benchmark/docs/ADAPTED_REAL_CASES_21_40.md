# Adapted-Real Cases 21–40

The benchmark includes 20 adapted-real cases (`21`–`40`), introduced in v0.3.0. These cases are not verbatim copies of source documents. Each case paraphrases and condenses a relation pattern from an official or public source into the benchmark schema.

## Case list

| Case | Domain | Relation | Complexity | Source family |
|---|---|---:|---:|---|
| 21 | technical_ops | contraindication | 1 | Kubernetes |
| 22 | technical_ops | override | 3 | Kubernetes |
| 23 | technical_ops | exception | 2 | Kubernetes |
| 24 | technical_ops | override | 1 | Kubernetes |
| 25 | technical_ops | override | 3 | AWS IAM |
| 26 | technical_ops | override | 2 | AWS S3 |
| 27 | technical_ops | scope | 2 | AWS CloudFormation |
| 28 | clinical | contraindication | 2 | DailyMed |
| 29 | clinical | precondition | 2 | DailyMed |
| 30 | clinical | sequence | 2 | DailyMed |
| 31 | clinical | exception_of_exception | 3 | DailyMed |
| 32 | clinical | exception_of_exception | 3 | DailyMed |
| 33 | regulatory | scope | 2 | IRS |
| 34 | regulatory | exception | 2 | IRS |
| 35 | regulatory | temporal_dependency | 2 | IRS |
| 36 | education | scope | 1 | University policy |
| 37 | education | precondition | 2 | University policy |
| 38 | education | temporal_dependency | 1 | University policy |
| 39 | technical_ops | override | 1 | RFC 9111 |
| 40 | technical_ops | exception | 3 | RFC 6749 |

## Adaptation rule

For adapted-real cases, the benchmark case text is the evaluation source of truth. Original sources are used only to ground the relation pattern. The benchmark intentionally avoids using full source documents so that the evaluation remains about composition under evidence sufficiency rather than long-context retrieval.

## Professional guidance warning

These cases must not be used for clinical, legal, tax, immigration, cloud-operations, university-policy, or other real-world decisions. They are benchmark artifacts only.
