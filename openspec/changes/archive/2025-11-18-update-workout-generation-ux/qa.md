## Manual QA Script — Workout Generation UX

### 1. BYOK / Offline Paths
1. Launch the app with networking disabled and no BYOK key.
2. Verify the hero card shows the inline warning + Configure button and that Generate/Customize CTAs are disabled.
3. Open the BYOK sheet, paste a valid key, save, and confirm the Offline banner disappears after a refetch.

### 2. Stage-Only Flow
1. From the Home screen, tap `Time` and choose `45 min`, then tap **Apply** (not Generate).
2. Confirm the Time chip now shows `45` with the staged indicator dot and that the Reset affordance appears.
3. Force a pull-to-refresh; the staged value should remain because it is kept in memory until cleared.

### 3. Stage + Generate Flow
1. Tap `Apply & Generate` from the Focus sheet after picking a new value.
2. Observe the hero button transition to “Generating…” immediately and, after ~400 ms, the overlay spinner messaging (even if you navigate away and back).
3. Once the request finishes, the staged indicators clear automatically, the new plan details match the request, and the snapshot refetch resets `generationStatus` to `idle`.

### 4. Long Call / Pending State
1. Temporarily throttle the network (or point to a slow backend) so generation takes >10 s.
2. Trigger Generate and switch to another view; when you return to Home, the hero overlay should still display `Generating your workout (~XXs)` and the quick actions should be disabled with the “Finishing current generation…” hint.
3. Verify that `Preview`/`Log done` buttons are disabled until the overlay clears.

### 5. Failure / Retry
1. Remove/invalid the API key and trigger Generate to force a fallback.
2. Confirm the hero card keeps the previous plan, surfaces the error pill, and changes the CTA copy to “Retry generation”.
3. Hit **Retry generation**; once you restore a valid key the generation succeeds, clears the error state, and the Reset affordance disappears.
