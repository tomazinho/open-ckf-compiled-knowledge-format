# Portuguese-Brazilian Parallel Cases

The directory `cases_pt-br/` contains Portuguese-Brazilian draft translations of all benchmark cases.

## Status

These files are parallel review artifacts. The canonical benchmark source remains `cases/*.json`.

## Preservation policy

The translation preserves:

- `case_id` values;
- JSON structure;
- source URLs;
- inline XML-style relation tags;
- YAML-like compiled representation shape;
- scoring fields and controls.

## Recommended review process

Before public release as a fully validated Portuguese benchmark, review each case for:

1. semantic equivalence with the English case;
2. preservation of the relation pattern;
3. no accidental addition of facts;
4. clarity of the gold answer and minimal answer;
5. consistency of technical terms such as override, scope, PDB, eGFR, MAGI, and no-store.
