## Context

Projection tells the app what kind of session should happen. It does not by itself decide whether an exercise should be repeated for progression or swapped for novelty. Slot policy provides that missing structure where a program needs it.

This change depends on session-level attribution and projection intent. It does not add new projection strategies or UI.

## Goals / Non-Goals

**Goals:**

- Model optional exercise slots for programs that need stability.
- Track current slot assignments and slot history.
- Feed slot policy into deterministic planning and staged planner inputs.
- Preserve stable or locked slots when viable.
- Allow coach-rotatable slots to vary within hard constraints.

**Non-Goals:**

- Require all programs to use slots.
- Build progression, deload, or peaking logic.
- Expose slot editing as primary UI.
- Relax hard constraints to preserve a slot.
- Replace the existing two-stage generation planner.

## Decisions

### 1. Slots Are Optional

Slot templates are used only when a program benefits from stable exercise or movement roles. Flexible programs can omit slots and continue to rely on block intent, target ranges, and generation context.

### 2. Slot Stability Is A Policy

Each slot has a stability policy:

- `stable`: preserve assignment when compatible with hard constraints.
- `coach-rotatable`: allow rotation for novelty, recovery, equipment, or progression needs.
- `user-locked`: preserve unless impossible under hard constraints.

### 3. Hard Constraints Win

Equipment, injuries, avoid lists, explicit user overrides, and event-protected stressors remain authoritative. When a slot cannot be preserved, planning records an override reason and selects a compatible alternative.

### 4. Slot History Requires Attribution

Slot history is useful only when generated/logged workouts can be tied back to program sessions. This change therefore depends on the attribution stage and should persist slot ids with generated workout metadata where relevant.

### 5. Generation Receives Structured Intent

The deterministic planning brief receives coach projection intent and slot policy before provider prompting. The staged planner may interpret ambiguous slot tradeoffs, but it cannot broaden beyond deterministic candidate constraints.

## Risks / Trade-offs

- [Risk] Slot templates overfit strength training. Mitigation: keep slots optional and fixture at least one program without slots.
- [Risk] Preserving slots reduces workout variety. Mitigation: use coach-rotatable slots for accessories and non-critical work.
- [Risk] Prompt-only slot handling is brittle. Mitigation: include slot policy in structured planning inputs and tests, not only prose.
- [Risk] Slot history becomes stale after manual edits. Mitigation: derive assignment history from attributed saved workouts and explicit user locks.

## Migration Plan

1. Add shared slot-template and slot-assignment contracts.
2. Update selected blueprint definitions to seed slots only where relevant.
3. Persist slot assignment metadata with generated workouts.
4. Feed projection intent and slot policy into the planning brief and staged planner inputs.
5. Add tests for stable preservation, rotatable novelty, and hard-constraint override.
