## Why
The app currently uses hardcoded mock data (`createGenerationContextMock`) when generating workouts, ignoring what equipment the user actually has and their fitness level. This makes every generated workout generic and often irrelevant. Users need to configure their profile once so the AI can generate personalized workouts.

## What Changes
- Add a **Profile/Settings screen** where users can configure:
  - Available equipment (multi-select)
  - Experience level (beginner/intermediate/advanced)
  - Primary fitness goal (optional text)
  - Injuries or constraints (optional list)
- Store profile data in the local `User.preferences` JSON field (WatermelonDB).
- Update the **generation flow** to read real user profile data instead of calling `createGenerationContextMock`.
- Add a **first-run onboarding** prompt if the user has not configured their profile yet.

## Impact
- Affected specs: New `user-profile` spec
- Affected code:
  - `apps/mobile/src/app/SettingsScreen.tsx` (expand)
  - `apps/mobile/src/app/db/repositories/UserRepository.ts`
  - `apps/mobile/src/app/services/api.ts` (inject real context)
  - `packages/shared/src/lib/contracts/workouts.ts` (optional: add `UserProfile` schema)

