## 1. Data Layer
- [x] 1.1 Define a `UserPreferences` TypeScript type in `packages/shared` matching the `GenerationContext.userProfile` + `preferences` + `environment.equipment` shape.
- [x] 1.2 Update `UserRepository` to expose `getPreferences()` and `updatePreferences()` methods that parse/serialize the JSON.

## 2. Profile UI
- [x] 2.1 Create or expand `SettingsScreen` with a "My Profile" section.
- [x] 2.2 Add Equipment multi-select (predefined list: Bodyweight, Dumbbells, Barbell, Kettlebells, Pull-up Bar, Resistance Bands, etc.).
- [x] 2.3 Add Experience Level picker (Beginner / Intermediate / Advanced).
- [x] 2.4 Add optional "Primary Goal" text input.
- [x] 2.5 Add optional "Injuries / Constraints" list input.
- [x] 2.6 Wire Save button to persist via `UserRepository.updatePreferences()`.

## 3. Generation Integration
- [x] 3.1 Update `api.ts` `generateWorkout()` to read user preferences from the DB and build a real `GenerationContext` instead of using `createGenerationContextMock`.
- [x] 3.2 Inject recent workout history (last 3-5 sessions) into `recentSessions` field.

## 4. Onboarding Prompt
- [x] 4.1 On Home Screen, detect if `preferences` is empty/default and show a banner: "Set up your profile for better workouts".
- [x] 4.2 Tapping the banner navigates to the Profile section.

## 5. Polish
- [x] 5.1 Add accessibility labels to new form elements.
- [ ] 5.2 Verify data persists across app restarts.

