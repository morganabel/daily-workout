## MODIFIED Requirements

### Requirement: Deterministic Eligibility Query Surface

The system MUST expose a read-only query surface for eligible exercise selection that distinguishes hard filters, explicit exclusions, and soft bias. Hard filters and exclusions MUST never be relaxed silently by the query layer.

The query surface MUST support, at minimum, exercise lookup by ID or alias and eligible-pool queries constrained by equipment, contraindications, avoid tags, explicit excluded exercise IDs, environment limits, experience level, and coarse load or style preferences.

Eligible-pool queries MUST default to returning only exercises whose `metadataCompleteness` is `planner-ready`, unless a caller is explicitly using an internal/debug path that requests lower-completeness records.

When a caller provides optional search text, the query surface MUST apply full-text ranking only within the already eligible set, using deterministic ordering rules after hard filtering. Search text MUST represent desired exercise intent only. Injury, contraindication, avoid, disallowed-stressor, and exclusion terms MUST NOT contribute positive FTS or BM25 rank.

Adding a hard filter or explicit exclusion to a query MUST produce a subset of, or the same eligible set as, the query without that constraint.

#### Scenario: Hard constraints exclude ineligible exercises

- **WHEN** a caller requests eligible exercises with hard filters for available equipment, injury-related exclusions, and low-impact quiet conditions
- **THEN** the result contains only exercises that satisfy all of those hard filters

#### Scenario: Explicit exercise ID is excluded before ranking

- **WHEN** a caller supplies an exercise ID resolved from an avoid-list alias
- **THEN** that exercise is absent from the eligible set regardless of its name, aliases, FTS score, or style score

#### Scenario: Negative term cannot promote a result

- **WHEN** injury, contraindication, avoid, stressor, or exclusion information is supplied to an eligible query
- **THEN** it is applied through structured filters or IDs and is not included in positive search ranking

#### Scenario: Additional constraint is monotonic

- **WHEN** the same query is run with one additional hard constraint or excluded ID
- **THEN** no exercise absent from the less-constrained eligible set appears in the more-constrained set

#### Scenario: Empty result is explicit when hard filters are too strict

- **WHEN** no exercises satisfy the supplied hard filters
- **THEN** the query layer returns an explicit empty result instead of broadening into disallowed exercises

#### Scenario: Stable ordering makes query results reproducible

- **WHEN** the same eligible-exercise query runs repeatedly against the same library version
- **THEN** it returns exercises in a deterministic order so planning and tests can reproduce candidate pools

#### Scenario: Planner queries exclude lower-completeness records by default

- **WHEN** a production candidate-pool query runs against a library that contains `raw`, `derived`, `curated`, and `planner-ready` records
- **THEN** only `planner-ready` exercises are eligible unless the caller explicitly opts into a lower completeness threshold for internal use

#### Scenario: BM25 ranks text-relevant exercises within a hard-filtered pool

- **WHEN** a candidate query includes positive search text alongside hard filters such as equipment and environment constraints
- **THEN** the library returns only exercises that satisfy the hard filters, with BM25/FTS ranking used only to order the eligible set by desired relevance
