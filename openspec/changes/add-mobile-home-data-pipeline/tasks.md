## 1. Shared Contracts & Tooling
- [ ] 1.1 Add shared Zod schemas/types for `TodayPlan`, `WorkoutSessionSummary`, quick-action presets, and generator inputs under `packages/shared` (exported to mobile + server).
- [ ] 1.2 Create a `homeSnapshot` contract that bundles plan + recent sessions + offline hints, including mock factories for tests.
- [ ] 1.3 Add Nx target docs (README snippet or comments) explaining how mobile/server consume the new contracts.

## 2. Server APIs
- [ ] 2.1 Implement `GET /api/home/snapshot` (or equivalent app router handler) that authenticates via `DeviceToken`, returns the shared `homeSnapshot` payload, and falls back to deterministic mock data when no plan exists.
- [ ] 2.2 Add `POST /api/workouts/generate` stub that accepts quick-action selections and enqueues/generates the plan, returning the updated `TodayPlan` shape.
- [ ] 2.3 Add `POST /api/workouts/:id/log` (or similar) that marks completion, updates history, and returns the refreshed snapshot (or at least success + new session summary).
- [ ] 2.4 Cover the new handlers with unit/integration tests using mocked Prisma + AI provider, including offline/BYOK rejection cases.

## 3. Mobile Data Layer
- [ ] 3.1 Replace `useMockedHomeData` with a hook that calls `homeSnapshot`, caches results, exposes loading/error/offline states, and refetches after mutations.
- [ ] 3.2 Wire hero CTA buttons (`Generate workout`, `Start workout`, `Log done`) to the real endpoints with optimistic UI + disabled states while pending.
- [ ] 3.3 Implement quick-action sheets that stage parameters locally, invoke generation with the selected context, and close when complete.
- [ ] 3.4 Drive the Preview screen from navigation params fed by the fetched plan data rather than static mocks, and persist the payload for offline viewing within the session.
- [ ] 3.5 Implement BYOK/offline detection that watches connectivity + SecureStore state, driving `OfflineBanner` and hero warnings.

## 4. QA & Tooling
- [ ] 4.1 Add Jest tests for the data hook and CTA handlers (mocking fetch + connectivity) plus server route tests.
- [ ] 4.2 Document manual test script covering happy path, offline, empty history, and BYOK flows.
- [ ] 4.3 Run `nx run-many --target=test --projects=server,mobile` (or equivalent) and provide results before requesting review.
