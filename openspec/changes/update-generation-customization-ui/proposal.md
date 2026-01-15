## Why

Quick actions and the "Customize" flow do not clearly signal that they affect the next workout generation, and the Customize sheet exposes fewer options than the regenerate sheet. This creates confusion and inconsistent behavior.

## What Changes

- Unify generation customization to use the richer regenerate bottom sheet for both initial Generate and Regenerate flows
- Reframe quick actions as generation inputs integrated with the generate CTA (placement and labeling), so they read as pre-generate configuration rather than separate actions
- Ensure the Customize action opens the same full set of options and uses the staged generation context

## Impact

- Affected specs: mobile-ui
- Affected code: `apps/mobile` home screen quick actions, generation bottom sheet, generation state staging
