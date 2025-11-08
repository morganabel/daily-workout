## Why
Users need to inspect the suggested workout before starting timers so they can confirm equipment, energy, and block details.

## What Changes
- Add a simple in-app screen switcher to show a dedicated workout preview page.
- Replace the Home hero secondary CTA with a Preview button that navigates to the new page.
- Build a non-interactive Workout Preview layout mirroring the eventual active workout UI.

## Impact
- Affected specs: `mobile-ui`
- Affected code: `apps/mobile/src/app/App.tsx`, `apps/mobile/src/app/HomeScreen.tsx`, `apps/mobile/src/app/WorkoutPreviewScreen.tsx`

