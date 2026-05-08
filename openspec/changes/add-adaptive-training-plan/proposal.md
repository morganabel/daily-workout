## Why

The current starter plan is represented as a fixed 7-day slot sequence, which does not match how many users actually train. Weight lifting and general fitness users often think in weeks, but their plans are flexible: blocks can move, targets are ranges, sessions can combine, and the right next workout depends on recent training plus upcoming life events.

This change establishes the first durable planning layer for the larger coaching vision: a plan that understands training blocks, rolling target ranges, typical week preferences, projected schedules, pinned commitments, and explainable coach recommendations.

## What Changes

- Add an adaptive training plan model that becomes the source of truth for flexible fitness planning.
- Model reusable training blocks such as Push, Pull, Legs, Easy Cardio, Sprint, Abs/Accessory, Mobility, and Rest.
- Replace fixed weekly quotas with target ranges, such as Lift 3-5, Cardio 2-3, Sprint 1, Rest 0-2 over a rolling planning window.
- Support typical week preferences without treating them as fixed calendar commitments.
- Distinguish preferred, projected, and pinned sessions so the coach can reflow flexible plans while preserving user commitments.
- Add deterministic recommendation logic that chooses the next useful block or combined blocks from plan state, recent history, target ranges, and upcoming events.
- Allow compatible blocks to combine, such as Pull + Easy Cardio or Push + Abs.
- Update Home to show an explainable recommended next session and generate from that recommendation.
- Update plan/profile UI away from “starter week” editing and toward training rhythm, blocks, target ranges, and typical week preferences.
- Preserve one-off Today generation for users who skip setup, but make adaptive training plans the only template-based planning model.
- Do not add hosted-only behavior, billing, quotas, or paid plan restrictions; CE and hosted use the same local planning model.

## Capabilities

### New Capabilities

- `training-plan`: Defines adaptive training plans, reusable blocks, target ranges, typical week preferences, schedule projections, pinned sessions, combined-session recommendations, and the coaching foundation for future multi-week planning.

### Modified Capabilities

- `training-blueprint`: Template onboarding must seed adaptive training plans instead of fixed 7-day starter slots.
- `user-profile`: Profile preferences must persist the accepted adaptive plan, target ranges, training blocks, and typical week preferences.
- `home-data`: Home data must expose plan state and the recommended next session with rationale.
- `mobile-ui`: Onboarding, Home, and Profile/Plan Settings must present training rhythm, target ranges, coach recommendations, and flexible weekly projections instead of only starter-week slots.
- `generation-planning`: Generation planning must accept adaptive plan intent, including a primary block and optional add-on blocks, while still honoring safety and schedule constraints.

## Impact

- `packages/shared`: New Zod contracts for adaptive plans, blocks, target ranges, typical week preferences, projection status, recommendation rationale, and adaptive generation intent.
- `apps/mobile`: Onboarding/profile updates, local persistence, recommendation resolver, Home recommendation UI, plan settings UI, and planned-event integration for pinned/projected sessions.
- `packages/server-core`: Planning brief support for adaptive plan intent and combined block intent.
- `packages/server-ai`: Prompt inputs include structured adaptive plan intent when present.
- `openspec/specs`: Adds `training-plan` and modifies `training-blueprint`, `user-profile`, `home-data`, `mobile-ui`, and `generation-planning`.
- Tests: Shared contract tests, deterministic resolver tests, Home data tests, mobile UI tests, and generation-planning tests for the adaptive-only planning path.
