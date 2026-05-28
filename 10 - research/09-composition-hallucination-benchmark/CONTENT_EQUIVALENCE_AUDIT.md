# Content Equivalence Audit

This audit records the intended equivalence among the three representation conditions for each benchmark case:

- `raw`: natural prose with implicit relations.
- `annotated`: same prose with lightweight relation tags.
- `compiled`: same substantive content represented as typed objects.

The purpose is to support the protocol's counterfactual explicitness control: improvements in `annotated` or `compiled` should be attributable to explicit relational structure, not to new facts.

## Audit status

All 20 cases were checked during packaging for the following constraints:

1. No representation condition should introduce a new substantive fact not present in the raw source.
2. Numeric values, dates, thresholds, authorities, requirements, and exceptions should match across conditions.
3. Tag attributes and compiled fields should encode relations derivable from raw prose.
4. Local probes and gold answers should depend only on fragments present in the case.

## Case-level audit table

| File | Domain | Relation | Complexity | Status |
|---|---|---:|---:|---|
| `01_exception_education_reimbursement.json` | `corporate_policy` | `exception` | 1 | raw/annotated/compiled checked for matched substantive content |
| `02_override_incident_severity.json` | `technical_ops` | `override` | 1 | raw/annotated/compiled checked for matched substantive content |
| `03_scope_childcare_subsidy.json` | `eligibility` | `scope` | 1 | raw/annotated/compiled checked for matched substantive content |
| `04_precondition_vendor_payment.json` | `corporate_policy` | `precondition` | 2 | raw/annotated/compiled checked for matched substantive content |
| `05_sequence_deploy_migration.json` | `technical_ops` | `sequence` | 2 | raw/annotated/compiled checked for matched substantive content |
| `06_contraindication_postgres_config.json` | `technical_ops` | `contraindication` | 1 | raw/annotated/compiled checked for matched substantive content |
| `07_temporal_data_retention_cutover.json` | `corporate_policy` | `temporal_dependency` | 2 | raw/annotated/compiled checked for matched substantive content |
| `08_exception_of_exception_software_procurement.json` | `corporate_policy` | `exception_of_exception` | 3 | raw/annotated/compiled checked for matched substantive content |
| `09_chained_education_loan_program.json` | `corporate_policy` | `exception` | 3 | raw/annotated/compiled checked for matched substantive content |
| `10_chained_change_management_emergency.json` | `technical_ops` | `override` | 3 | raw/annotated/compiled checked for matched substantive content |
| `11_exception_lease_repair_access_pause.json` | `legal` | `exception` | 1 | raw/annotated/compiled checked for matched substantive content |
| `12_contraindication_clinical_lumaren_renal.json` | `clinical` | `contraindication` | 1 | raw/annotated/compiled checked for matched substantive content |
| `13_scope_arts_microgrant_project_location.json` | `eligibility` | `scope` | 1 | raw/annotated/compiled checked for matched substantive content |
| `14_temporal_regulatory_breach_reporting_cutover.json` | `regulatory` | `temporal_dependency` | 2 | raw/annotated/compiled checked for matched substantive content |
| `15_precondition_clinical_aurelin_infusion_kit.json` | `clinical` | `precondition` | 2 | raw/annotated/compiled checked for matched substantive content |
| `16_sequence_education_exam_accommodation_packet.json` | `education` | `sequence` | 2 | raw/annotated/compiled checked for matched substantive content |
| `17_override_technical_ops_firewall_freeze.json` | `technical_ops` | `override` | 2 | raw/annotated/compiled checked for matched substantive content |
| `18_exception_of_exception_tax_research_credit_contractor.json` | `regulatory` | `exception_of_exception` | 3 | raw/annotated/compiled checked for matched substantive content |
| `19_chained_clinical_discharge_renal_cutover.json` | `clinical` | `contraindication` | 3 | raw/annotated/compiled checked for matched substantive content |
| `20_chained_eligibility_disaster_housing_grant.json` | `eligibility` | `precondition` | 3 | raw/annotated/compiled checked for matched substantive content |

## Reviewer note

This is an authoring audit, not an independent expert validation. Before publication of empirical claims, at least one independent reviewer should verify that annotated and compiled forms do not add facts or resolve ambiguity that is not present in the raw prose.
