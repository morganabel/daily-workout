## ADDED Requirements

### Requirement: Evaluation Scenario Corpus

The system MUST define a versioned workout-generation evaluation corpus containing at least 50 named scenarios. Each scenario MUST describe the backend generation inputs needed to exercise realistic workout behavior, including request fields, optional merged context, optional regeneration state, optional upcoming events, and expected hard constraints.

#### Scenario: Beginner bodyweight easy session

- **GIVEN** a beginner profile with bodyweight-only equipment, easy energy, and a short time budget
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario covering that input combination and its expected hard constraints

#### Scenario: Beginner bodyweight moderate session

- **GIVEN** a beginner profile with bodyweight-only equipment, moderate energy, and a standard time budget
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario covering that input combination and its expected hard constraints

#### Scenario: Beginner dumbbell intro session

- **GIVEN** a beginner profile with dumbbells available and no recent sessions
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario for an introductory dumbbell workout

#### Scenario: Intermediate dumbbell upper-body session

- **GIVEN** an intermediate profile with dumbbells, explicit upper-body focus, and moderate energy
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario for that focused request

#### Scenario: Intermediate dumbbell lower-body session

- **GIVEN** an intermediate profile with dumbbells, explicit lower-body focus, and moderate energy
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario for that focused request

#### Scenario: Advanced full-gym strength session

- **GIVEN** an advanced profile with barbell, rack, bench, and broad gym equipment
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario for a strength-oriented full-gym request

#### Scenario: Advanced conditioning session

- **GIVEN** an advanced profile with conditioning-friendly equipment and intense energy
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario for a high-output conditioning request

#### Scenario: Short low-energy reset

- **GIVEN** a user profile with easy energy and only 15 minutes available
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario for a low-friction reset workout

#### Scenario: Long intense session

- **GIVEN** a user profile with intense energy and 60 or more minutes available
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario for a longer, higher-volume session

#### Scenario: Auto-focus request

- **GIVEN** a request that leaves focus on auto or smart selection
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario that relies on context-driven focus selection

#### Scenario: Explicit focus override

- **GIVEN** a request with an explicit focus override
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario showing how explicit focus should constrain generation

#### Scenario: No-equipment fallback

- **GIVEN** a request with no equipment supplied and no profile equipment configured
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario that expects a bodyweight-compatible workout

#### Scenario: Equipment-rich home gym

- **GIVEN** a profile with a mixed home-gym setup such as dumbbells, bands, bench, and pull-up bar
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario covering multi-equipment selection

#### Scenario: Shoulder constraint

- **GIVEN** a user profile that lists a shoulder injury or constraint
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario that exercises injury-aware generation

#### Scenario: Lower-back constraint

- **GIVEN** a user profile that lists a lower-back injury or constraint
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario that exercises injury-aware generation

#### Scenario: Avoid-list constraint

- **GIVEN** a user profile that explicitly avoids a movement category or exercise family
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario that exercises avoid-list enforcement

#### Scenario: Recent heavy leg day

- **GIVEN** recent sessions include a heavy leg workout with high perceived effort
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario that tests recency-aware adaptation

#### Scenario: Recent push overload

- **GIVEN** recent sessions include multiple push-dominant workouts
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario that tests variation away from repeated push work

#### Scenario: Recent conditioning fatigue

- **GIVEN** recent sessions show hard conditioning work and fatigue-oriented notes
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario that tests recovery-aware adaptation

#### Scenario: Upcoming run context

- **GIVEN** the request includes an upcoming run within the next few days
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario that exercises planned-event context

#### Scenario: Upcoming hike context

- **GIVEN** the request includes an upcoming hike within the next few days
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario that exercises planned-event context

#### Scenario: Upcoming travel context

- **GIVEN** the request includes an upcoming travel day within the next few days
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario that exercises planned-event context

#### Scenario: Notes-driven custom instructions

- **GIVEN** the request includes free-form notes with explicit workout instructions
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario that tests whether notes materially shape generation

#### Scenario: Preferred-style bias

- **GIVEN** the user profile includes a preferred training style
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario that exercises style-aware generation

#### Scenario: Primary-goal bias

- **GIVEN** the user profile includes an explicit primary goal such as strength or endurance
- **WHEN** the evaluation corpus is reviewed
- **THEN** it includes a named scenario that exercises goal-aware generation

### Requirement: Hard Constraint Evaluation

The evaluation workflow MUST score every generated workout against deterministic hard checks. These checks MUST cover schema validity, duration fit, equipment compatibility, injury and avoid-list safety, and regeneration difference where applicable.

#### Scenario: Schema-valid response passes hard checks

- **GIVEN** a generated workout that validates against the shared `TodayPlan` contract
- **WHEN** hard checks are executed
- **THEN** the schema-validity check passes

#### Scenario: Invalid response fails schema hard check

- **GIVEN** a generation result that does not satisfy the shared `TodayPlan` contract
- **WHEN** hard checks are executed
- **THEN** the scenario is marked as a hard failure for schema validity

#### Scenario: Duration fit passes within tolerance

- **GIVEN** a generated workout whose total duration is within the evaluation tolerance for the requested time budget
- **WHEN** hard checks are executed
- **THEN** the duration-fit check passes

#### Scenario: Duration overrun fails hard check

- **GIVEN** a generated workout whose total duration materially exceeds the requested time budget
- **WHEN** hard checks are executed
- **THEN** the duration-fit check fails

#### Scenario: Equipment-compatible plan passes hard check

- **GIVEN** every exercise in the generated workout can be performed with the allowed equipment set
- **WHEN** hard checks are executed
- **THEN** the equipment-fit check passes

#### Scenario: Equipment mismatch fails hard check

- **GIVEN** a generated workout requires equipment that was not available in the scenario inputs
- **WHEN** hard checks are executed
- **THEN** the equipment-fit check fails

#### Scenario: Injury-safe plan passes hard check

- **GIVEN** a generated workout avoids the movements prohibited by the scenario injuries and avoid list
- **WHEN** hard checks are executed
- **THEN** the injury-safety check passes

#### Scenario: Injury conflict fails hard check

- **GIVEN** a generated workout includes movements that conflict with the scenario injuries or avoid list
- **WHEN** hard checks are executed
- **THEN** the injury-safety check fails

#### Scenario: Regeneration difference passes hard check

- **GIVEN** a regeneration scenario where the new workout materially differs from the prior workout according to the rubric
- **WHEN** hard checks are executed
- **THEN** the regeneration-difference check passes

#### Scenario: Regeneration clone fails hard check

- **GIVEN** a regeneration scenario where the new workout is effectively a near-clone of the prior workout
- **WHEN** hard checks are executed
- **THEN** the regeneration-difference check fails

### Requirement: Repeated Stochastic Execution

The evaluation workflow MUST support repeated execution of the same scenario without assuming exact-output determinism. It MUST preserve scenario identity while recording run identity, provider, and execution metadata for each run.

#### Scenario: Same scenario runs multiple times

- **GIVEN** a scenario is configured for repeated execution
- **WHEN** the evaluation runner is invoked
- **THEN** it can execute the same scenario multiple times while preserving a distinct record for each run

#### Scenario: Scenario identity remains stable across runs

- **GIVEN** the same scenario is executed repeatedly
- **WHEN** results are recorded
- **THEN** each result references the same scenario identifier and a distinct run identifier

#### Scenario: Provider comparison run

- **GIVEN** a scenario is configured to run against more than one supported provider
- **WHEN** the evaluation runner is invoked
- **THEN** it records separate run results for each provider without conflating them

#### Scenario: Hard-check-only execution mode

- **GIVEN** the evaluator wants to skip soft review
- **WHEN** the evaluation runner is invoked in hard-check-only mode
- **THEN** it executes the scenario set and records hard-check outcomes without requiring AI-assisted scoring

#### Scenario: Partial run failures are preserved

- **GIVEN** one or more repeated runs fail because of provider errors or quota issues
- **WHEN** the evaluation runner completes
- **THEN** successful and failed runs are both retained in the report output

#### Scenario: Corpus subset execution

- **GIVEN** the evaluator chooses a tagged subset of the full corpus
- **WHEN** the evaluation runner is invoked
- **THEN** it executes only the selected scenarios while preserving the same scoring behavior

### Requirement: Soft Quality Review

The evaluation workflow MUST support rubric-based soft review for workout quality. Soft review MAY be performed manually or with AI assistance, but the workflow MUST preserve the rubric version and reviewer source for every soft score.

#### Scenario: Manual soft review

- **GIVEN** a founder wants to review workouts manually
- **WHEN** soft review is performed
- **THEN** the workflow accepts manual scores and notes for the defined rubric dimensions

#### Scenario: AI-assisted soft review

- **GIVEN** the evaluator enables AI assistance for soft review
- **WHEN** the evaluation workflow scores outputs
- **THEN** it records rubric-aligned soft scores and notes from the AI reviewer without replacing hard checks

#### Scenario: Soft review remains optional

- **GIVEN** the evaluator only wants objective rule checks
- **WHEN** the evaluation workflow is run
- **THEN** it can complete successfully without any soft-review step

#### Scenario: Reviewer source is recorded

- **GIVEN** a run receives soft review
- **WHEN** results are stored in the report output
- **THEN** each soft score records whether it came from manual review or AI assistance

#### Scenario: Rubric version is recorded

- **GIVEN** the soft-review rubric evolves over time
- **WHEN** a run is scored
- **THEN** the report records the rubric version used for that score

### Requirement: Regeneration Evaluation Coverage

The evaluation corpus MUST include regeneration scenarios that exercise the current regeneration inputs, including `previousResponseId`, structured feedback, request overrides, upcoming events, and free-form notes.

#### Scenario: Too-hard feedback regeneration

- **GIVEN** a prior workout and regeneration feedback of `too-hard`
- **WHEN** the regeneration scenario is executed
- **THEN** the corpus includes a named scenario that evaluates whether the regenerated workout adapts to that feedback

#### Scenario: Too-easy feedback regeneration

- **GIVEN** a prior workout and regeneration feedback of `too-easy`
- **WHEN** the regeneration scenario is executed
- **THEN** the corpus includes a named scenario that evaluates whether the regenerated workout adapts to that feedback

#### Scenario: Different-exercises regeneration

- **GIVEN** a prior workout and regeneration feedback of `different-exercises`
- **WHEN** the regeneration scenario is executed
- **THEN** the corpus includes a named scenario that evaluates exercise variation in the regenerated workout

#### Scenario: Just-try-again regeneration

- **GIVEN** a prior workout and regeneration feedback of `just-try-again`
- **WHEN** the regeneration scenario is executed
- **THEN** the corpus includes a named scenario that evaluates whether the new workout is meaningfully fresh

#### Scenario: Structured override plus regeneration

- **GIVEN** a prior workout, regeneration feedback, and a changed structured request such as new time, focus, or equipment
- **WHEN** the regeneration scenario is executed
- **THEN** the corpus includes a named scenario that evaluates both feedback handling and override handling together

#### Scenario: Notes-only regeneration

- **GIVEN** a prior workout and free-form regeneration notes without additional structured changes
- **WHEN** the regeneration scenario is executed
- **THEN** the corpus includes a named scenario that evaluates whether explicit notes shape the regenerated workout

#### Scenario: Regeneration with upcoming-event pressure

- **GIVEN** a prior workout, regeneration feedback, and upcoming events in the request context
- **WHEN** the regeneration scenario is executed
- **THEN** the corpus includes a named scenario that evaluates regeneration under future-load constraints

### Requirement: Cost-Aware Provider Execution

The evaluation workflow MUST make provider choice, execution mode, and cost implications explicit before broad runs begin. It MUST work in CE mode without billing overlays and MUST surface hosted-provider constraints before execution.

#### Scenario: CE run with configured key

- **GIVEN** the evaluator runs the workflow in CE with a configured provider key
- **WHEN** the evaluation run starts
- **THEN** the workflow executes against that provider without requiring hosted billing integrations

#### Scenario: CE plumbing run without key

- **GIVEN** the evaluator runs the workflow in CE without a provider key
- **WHEN** the evaluation run starts
- **THEN** the workflow can still exercise deterministic plumbing paths through an explicit fixture provider

#### Scenario: Hosted run without key blocked early

- **GIVEN** the evaluator targets a hosted-style execution path without a valid provider key
- **WHEN** the evaluation run starts
- **THEN** the workflow surfaces the missing-key problem before launching a broad batch

#### Scenario: Quota-sensitive run warning

- **GIVEN** the evaluator configures a broad batch against a provider or environment with known quota limits
- **WHEN** the evaluation run starts
- **THEN** the workflow surfaces a warning that the run may hit quota or cost limits

#### Scenario: Explicit run-count control

- **GIVEN** the evaluator chooses repeated stochastic execution
- **WHEN** the evaluation run starts
- **THEN** the workflow requires or records an explicit run-count setting rather than silently choosing batch size

### Requirement: Evaluation Reporting

The evaluation workflow MUST produce sanitized, reviewer-friendly reports. Reports MUST preserve per-scenario and aggregate results while excluding secrets such as API keys.

#### Scenario: Per-scenario report entry

- **GIVEN** a scenario run completes
- **WHEN** the report is generated
- **THEN** the report includes the scenario identifier, run identifier, provider, execution outcome, hard-check results, and plan summary

#### Scenario: Aggregate failure summary

- **GIVEN** a batch evaluation run completes
- **WHEN** the report is generated
- **THEN** the report includes aggregate summaries for hard-check failures, provider failures, and notable soft-review patterns

#### Scenario: Secret redaction

- **GIVEN** the evaluation run used env keys, BYOK headers, or other credentials
- **WHEN** the report is generated
- **THEN** no secret value appears in the report output

#### Scenario: Exportable report formats

- **GIVEN** a batch evaluation run completes
- **WHEN** the report is generated
- **THEN** the workflow emits outputs that are easy to inspect and diff, such as markdown and structured JSON
