# Datasheet

## Dataset name

Composition Hallucination Benchmark

## Authors and maintainers

Created and maintained by **CKF Research** and **Paulo Tomazinho** (paulo@tomazinho.com.br). The benchmark implements the protocol in *Composition Hallucination in Retrieval-Augmented Generation: A Failure Mode and Benchmark Protocol* (Tomazinho, CKF Research, 2026).

## Version

`0.5.0`

## Motivation

The dataset evaluates composition hallucination in retrieval-augmented generation: errors where all necessary evidence is present and locally legible, but the model fails to compose relations among fragments.

## Composition

- Total cases: 40
- Synthetic cases: 20
- Adapted-real cases: 20
- Representations per case: raw prose, relation-annotated prose, structurally compiled representation
- Local probes: included for every case
- Negative controls: included for every case
- Position controls: supported for every case
- Python evaluation runner: included (`scripts/`), multi-provider, with offline mock

## Distribution

```json
{
  "version": "0.5.0",
  "total_cases": 40,
  "by_source_status": {
    "synthetic": 20,
    "adapted": 20
  },
  "by_domain": {
    "corporate_policy": 5,
    "technical_ops": 14,
    "eligibility": 3,
    "legal": 1,
    "clinical": 8,
    "regulatory": 5,
    "education": 4
  },
  "by_relation_type": {
    "exception": 6,
    "override": 8,
    "scope": 5,
    "precondition": 5,
    "sequence": 3,
    "contraindication": 5,
    "temporal_dependency": 4,
    "exception_of_exception": 4
  },
  "by_complexity_level": {
    "1": 12,
    "2": 17,
    "3": 11
  },
  "cases_21_40_by_domain": {
    "technical_ops": 9,
    "clinical": 5,
    "regulatory": 3,
    "education": 3
  },
  "cases_21_40_by_relation_type": {
    "contraindication": 2,
    "override": 5,
    "exception": 3,
    "scope": 3,
    "precondition": 2,
    "sequence": 1,
    "exception_of_exception": 2,
    "temporal_dependency": 2
  },
  "cases_21_40_by_complexity_level": {
    "1": 5,
    "2": 10,
    "3": 5
  },
  "adapted_real_source_organizations_21_40": {
    "Kubernetes": 4,
    "Amazon Web Services": 3,
    "DailyMed / U.S. National Library of Medicine": 5,
    "Internal Revenue Service": 3,
    "University of Texas at San Antonio": 1,
    "University of York": 1,
    "University of Connecticut Residential Life": 1,
    "RFC Editor / IETF HTTP Working Group": 1,
    "IETF OAuth Working Group": 1
  }
}
```

## Source status

Cases `01`-`20` are synthetic. Cases `21`-`40` are adapted-real: they paraphrase and condense relation patterns from public or official source documents. Original source documents remain under their own terms.

## Recommended use

Use perfect retrieval for the primary composition test. A case should be composition-evaluable only if all `controls.necessary_fragments` are present in the model context and the model passes or is separately tested on local probes.

## Limitations

- Adapted-real cases are still condensed and simplified.
- Some source documents may change after the access date.
- Clinical, legal, tax, cloud, immigration, housing, and university-policy cases require expert review before being used beyond benchmark evaluation.
- The repository does not yet include the Python runner.


## v0.4.0-draft bilingual and CKF extensions

The dataset now includes Portuguese-Brazilian draft parallel cases and experimental CKF-compatible exports. The canonical benchmark remains the English JSON case schema.
