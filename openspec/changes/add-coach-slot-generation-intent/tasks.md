## 1. Slot Contracts

- [x] 1.1 Add exercise-slot template, slot stability policy, slot assignment, and slot override reason schemas
- [x] 1.2 Add generated-workout metadata fields needed to persist slot attribution
- [x] 1.3 Add tests for optional slot templates and slot policy validation

## 2. Blueprint Seeding

- [x] 2.1 Add slot templates to strength-oriented blueprints where repeated main lifts or movement slots matter
- [x] 2.2 Keep general fitness or weekly-balance blueprints slotless unless stability is required
- [x] 2.3 Add blueprint tests proving slots are optional and template-specific

## 3. Generation Planning

- [x] 3.1 Add coach projection intent (including session disposition: projected, pinned, repaired, substituted) and slot policy to generation request mapping and planning brief construction
- [x] 3.2 Include slot policy in staged planner inputs without relaxing deterministic hard constraints
- [x] 3.3 Update provider prompt construction to preserve stable/user-locked slots when viable and allow coach-rotatable slots to vary
- [x] 3.4 Record explicit slot override reasons when hard constraints force replacement

## 4. Validation

- [x] 4.1 Add generation-planning tests for stable slot preservation
- [x] 4.2 Add tests for coach-rotatable accessory slot variation
- [x] 4.3 Add tests proving injury, avoid-list, equipment, and event-protection constraints override slot preservation
- [x] 4.4 Run targeted shared contract and generation-planning tests through Nx
- [x] 4.5 Validate this OpenSpec change with `openspec validate add-coach-slot-generation-intent --strict`
