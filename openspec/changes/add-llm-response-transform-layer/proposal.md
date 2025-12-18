## Why
The server currently asks the LLM for the full client-facing workout schema and streams that response straight back to the app. That couples prompt design to the public API and spends tokens on fields the model could derive later, making it harder to iterate on smaller/cheaper schemas.

## What Changes
- Add a generation transformation layer that converts LLM responses into the canonical API workout schema, so prompt schemas can be simplified without changing client contracts.
- Support versioned LLM schemas and a feature flag to keep the current schema as the default while we validate the mapping logic.
- Extend validation/telemetry around the new step to catch mapping errors early and keep the existing deterministic/mock fallbacks when transformation fails.

## Impact
- Affected specs: home-data
- Affected code: server generation pipeline, shared schema definitions for LLM prompts vs `TodayPlan`, generation tests/fixtures, observability around mapping failures
