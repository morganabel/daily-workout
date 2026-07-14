## ADDED Requirements

### Requirement: Generated Workout Semantic Validation

After provider output is structurally transformed, the generation flow MUST semantically validate the workout against the authoritative planning brief and exercise-library eligibility contract before persisting or returning it.

Every AI-generated exercise MUST resolve to a stable planner-ready exercise identity in the hard-eligible candidate contract. The generated workout MUST satisfy available equipment, normalized contraindication tags, avoid tags, disallowed stressors, explicit safety exclusions, conditional baseline-variation rules, and deterministic duration limits. A baseline exercise MAY be reused only when the candidate contract records that no eligible alternative exists. A structurally valid `TodayPlan` alone MUST NOT be considered safe for production return.

#### Scenario: Provider selects unavailable equipment

- **WHEN** a provider returns an exercise whose required equipment is outside the planning brief's available equipment
- **THEN** semantic validation rejects the workout before persistence or response

#### Scenario: Provider returns explicitly avoided exercise alias

- **WHEN** a provider returns an alias that resolves to an explicitly avoided exercise
- **THEN** semantic validation rejects the workout using its stable exercise identity

#### Scenario: Provider repeats a baseline exercise despite alternatives

- **GIVEN** the candidate contract contains eligible alternatives to a baseline exercise
- **WHEN** a provider returns the baseline exercise anyway
- **THEN** semantic validation rejects the conditional variation violation

#### Scenario: Baseline reuse is the only eligible option

- **GIVEN** no eligible alternative exists for a still-safe baseline exercise
- **WHEN** the provider reuses that baseline exercise without violating a hard safety constraint
- **THEN** semantic validation permits the reuse and records the explicit variation fallback

#### Scenario: Provider returns unknown exercise

- **WHEN** a provider exercise cannot resolve to a planner-ready identity in the supplied eligible candidate contract
- **THEN** semantic validation treats it as unverifiable and does not return it as a successful AI workout

#### Scenario: Valid output proceeds unchanged

- **WHEN** every generated exercise resolves to the eligible contract and all hard constraints pass
- **THEN** the canonical `TodayPlan` may be persisted and returned without exposing validation internals

### Requirement: Bounded Safety Correction

When initial provider output fails semantic validation, the generation flow MAY make exactly one corrective provider call using typed violations and the unchanged hard-constraint candidate contract. It MUST validate the corrected output using the same rules and MUST NOT relax a hard constraint to obtain a result.

If correction fails, explicit AI mode MUST return a structured error. Auto mode MAY use an existing catalog fallback only after that workout passes the same semantic constraints. Unsafe provider output MUST NOT be persisted, returned, or metered as a successful generation.

#### Scenario: One correction repairs provider output

- **WHEN** the first output violates a hard constraint and the single corrective output satisfies every semantic check
- **THEN** the corrected workout is returned after one corrective final-generation call and diagnostics distinguish logical phase calls from SDK retry attempts

#### Scenario: Correction remains unsafe

- **WHEN** both initial and corrective outputs violate hard constraints
- **THEN** generation stops without another corrective final-generation call and returns a structured safety error or validated auto-mode catalog fallback

#### Scenario: Explicit AI does not silently change modes

- **WHEN** an explicit AI request remains unsafe after correction
- **THEN** the server returns the safety error rather than silently returning a library workout

## MODIFIED Requirements

### Requirement: Exercise-Library-Backed Candidate Pools

The planning layer MUST query the exercise library to derive bounded candidate pools that respect hard filters and may apply soft bias for style, goal, or load intent. The candidate-pool path MUST use the deterministic hard-filter semantics defined by the exercise-library capability. An AI provider call MUST NOT begin unless the authoritative library is available and the eligible candidate contract was constructed successfully.

Positive search and ranking inputs MUST be derived only from desired focus, movement, objective, and style intent. Injury text, contraindications, avoid lists, disallowed stressors, and baseline variation constraints MUST NOT contribute positive search rank. Safety constraints MUST be expressed as normalized hard filters or stable excluded exercise IDs. Baseline IDs MUST be represented separately as conditional variation exclusions that apply while eligible alternatives exist.

#### Scenario: Candidate pool honors hard environment and safety constraints

- **WHEN** a planning brief requires quiet, low-impact, bodyweight-only, or contraindication-aware selection
- **THEN** the derived candidate pool contains only exercises that satisfy those hard constraints

#### Scenario: Candidate pool can bias toward session identity

- **WHEN** a planning brief expresses a style identity such as bodybuilding, powerlifting, strongman, or climbing
- **THEN** the candidate-pool query can prefer matching exercises without violating hard constraints

#### Scenario: Avoid text cannot improve relevance

- **WHEN** a planning brief adds an injury or avoid phrase to an otherwise identical candidate query
- **THEN** the resulting eligible set stays the same or becomes smaller and no matching prohibited term gains search rank

#### Scenario: Explicit avoid alias becomes an exclusion

- **WHEN** an avoid-list value resolves to a known exercise name or alias
- **THEN** the planner passes its stable ID as a hard exclusion rather than adding the phrase to positive FTS text

#### Scenario: Authoritative library is unavailable

- **GIVEN** the exercise library cannot initialize or query its authoritative data
- **WHEN** an AI-backed generation request attempts to construct candidates
- **THEN** the server returns a structured dependency error without invoking the provider or continuing with an unverified candidate set
