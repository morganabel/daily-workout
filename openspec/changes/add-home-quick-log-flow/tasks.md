## 1. Implementation
- [ ] 1.1 Add a `quickLogManualSession` (or similar) helper to `WorkoutRepository` that creates a completed manual workout with `source: 'manual'`, `completedAt`, and `durationSeconds` derived from a `durationMinutes` input.
- [ ] 1.2 Add a `quickLogWorkout` helper to `apps/mobile/src/app/services/api.ts` that delegates to the repository helper and is structured so a future server quick‑log endpoint can be plugged in without changing callers.
- [ ] 1.3 Introduce a dedicated `QuickLogSheet` component under `apps/mobile/src/app/components/` that renders the Quick Log form (what, duration, when, optional note) and exposes `onSubmit` / `onCancel` callbacks.
- [ ] 1.4 Wire the Home screen so the bottom bar `Quick log` button opens `QuickLogSheet` with appropriate initial state (e.g., `when = now`), and remove the Backfill quick action chip from the quick‑actions rail.
- [ ] 1.5 On submit, validate the form, call `quickLogWorkout`, close the sheet on success, and rely on `useHomeData` subscriptions to update Recent Activity automatically.

## 2. UX & Copy
- [ ] 2.1 Finalize copy for the Quick Log sheet title, field labels, and CTA(s) so they clearly communicate the difference between Quick log and `Log done`.
- [ ] 2.2 Confirm how “Earlier today” should behave in the first release (fixed backdate vs explicit time picker) and adjust the sheet UI accordingly.

## 3. Testing & Validation
- [ ] 3.1 Add or extend tests in `HomeScreen.test.tsx` (and/or a dedicated Quick Log component test) to cover:
  - Opening the Quick Log sheet from the bottom `Quick log` button.
  - Submitting a valid quick log and observing that `recentSessions` is updated.
  - Basic validation behavior for missing required fields.
- [ ] 3.2 Manually test Quick log flows (online, offline, with and without BYOK) to confirm they satisfy the existing quick log scenarios in `mobile-ui` and `home-data`.
- [ ] 3.3 Run `openspec validate add-home-quick-log-flow --strict` and fix any spec issues.
