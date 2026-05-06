## ADDED Requirements

### Requirement: Adaptive Plan Intent
Generation planning MUST accept optional adaptive plan intent in addition to existing request fields and planned-slot intent. Adaptive plan intent MUST support plan id, recommendation id, source template id, primary block intent, optional add-on block intents, target range context, recommendation rationale, and projection status when available.

#### Scenario: Planning brief records adaptive source
- **WHEN** a generation request includes adaptive plan intent
- **THEN** the planning brief records adaptive-plan source metadata internally without changing the public `TodayPlan` response contract

#### Scenario: Combined blocks shape generation
- **WHEN** adaptive plan intent includes Pull as the primary block and Easy Cardio as an add-on
- **THEN** provider prompt inputs include both block intents so the generated workout can include appropriate strength and cardio work within the requested duration

### Requirement: Adaptive Intent Honors Safety And Explicit Overrides
The planning layer MUST treat adaptive plan intent as structured coaching intent while still honoring explicit user focus, injuries, avoid lists, equipment constraints, energy, recent fatigue, and upcoming event protection.

#### Scenario: Upcoming event can override recommended stressor
- **WHEN** adaptive plan intent recommends Legs but an upcoming event requires lower-body freshness
- **THEN** the planning brief adjusts load or focus rather than blindly following the recommendation

#### Scenario: Explicit focus remains stronger
- **WHEN** the user explicitly selects Mobility before generation while adaptive context recommends Pull
- **THEN** the planning brief resolves Mobility as the requested focus and treats adaptive context as background only where safe
