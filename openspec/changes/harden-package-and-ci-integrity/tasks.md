## 1. PR 1 - Pin Toolchain And Complete Existing CI Gates

**Depends on:** Nothing.

- [ ] 1.1 Update root engines to Node `>=24.15.0 <25` and npm `>=12 <13`; identify Node `24.16.0` and npm `12.0.1` as canonical, enforce the exact versions in CI and Docker, and allow npm 12 patch releases for ordinary local commands.
- [ ] 1.2 Set package-manager metadata to npm `12.0.1`, regenerate `package-lock.json` with that release, and verify `npm ci` produces no repository engine mismatch.
- [ ] 1.3 Align `nx` and every `@nx/*` dependency to one compatible exact version before regenerating the lockfile; remove deleted-workspace tombstones while retaining the new `metering`, `quotas`, and Cloud SQL dependencies.
- [ ] 1.4 Audit `npm install-scripts ls`, commit version-pinned `allowScripts` approvals only for required dependency lifecycle scripts, record explicit denials where appropriate, and enable `strict-allow-scripts=true` without a blanket allow-all escape hatch.
- [ ] 1.5 Update the existing GitHub Actions workflow to install and verify Node `24.16.0` and npm `12.0.1` before dependency installation; preserve `nx sync:check` and both Docker image jobs.
- [ ] 1.6 Pin Node `24.16.0` and install npm `12.0.1` in the shared Docker build stages before either Dockerfile runs `npm ci`.
- [ ] 1.7 Add an explicit `@workout-agent-ce/server:typecheck` target and audit every required project for target coverage; run dependency-aware Nx `lint`, `typecheck`, `test`, and `build` targets for affected projects on pull requests without silently omitting a missing required target.
- [ ] 1.8 Run the complete applicable Nx target set on the default branch so graph or workflow changes cannot hide behind affected calculation.
- [ ] 1.9 Preserve current lint warnings as visible output without combining warning cleanup into this PR.
- [ ] 1.10 Pin the project-standard OpenSpec CLI and expose one thin `validate:openspec` npm alias that forwards a change name or `--all` directly to strict CLI validation without a custom wrapper.
- [ ] 1.11 Run full strict OpenSpec validation in CI for every active change and canonical spec recognized by the CLI, and document the required local equivalent of every CI job.

### Acceptance Criteria

- A pull request changing one project runs that project and all dependency-required work.
- A failure in lint, typecheck, test, or build blocks the workflow.
- The server exposes and directly passes `@workout-agent-ce/server:typecheck`; CI asserts required-target coverage instead of treating absence as success.
- The main-branch job exercises all projects with applicable targets.
- Local development requires Node `24.16.0` and accepts npm `>=12 <13`; CI, Docker, lockfile changes, and exact local CI reproduction use npm `12.0.1`. The root engine contract rejects npm 11, npm 13, and incompatible Node 24 patch releases.
- The npm 12-generated lockfile remains reproducible under `npm ci` without uncommitted changes.
- The lockfile includes the current workspace packages and Cloud SQL dependency and contains no entry for the deleted `packages/billing` workspace.
- A clean npm 12 install has no unreviewed dependency install scripts; required native and tooling dependencies work, and adding a new unreviewed script fails CI until deliberately approved or denied.
- CI installation and baseline checks require no provider, billing, or other production secrets.
- CI runs full strict OpenSpec validation through the repository lockfile and does not depend on a custom wrapper or separately installed global executable.
- `nx sync:check`, the standalone server image build, and the migration image build remain required CI checks and use the pinned npm 12 toolchain.
- `nx report` shows one coherent exact Nx toolchain version set.

### Verification

```bash
node --version
npm --version
npm ci
npm install-scripts ls
nx sync:check
nx report
nx run @workout-agent-ce/server:typecheck
nx affected -t lint,typecheck,test,build --base=origin/main --head=HEAD
nx run-many -t lint,typecheck,test,build
docker build -f docker/Dockerfile.server -t workout-agent-server:ci .
docker build -f docker/Dockerfile.migrate -t workout-agent-migrate:ci .
npm run validate:openspec -- --all
npm run validate:openspec -- harden-package-and-ci-integrity
```

## 2. PR 2 - Correct Native ESM Package Output

**Depends on:** PR 1.

- [ ] 2.1 Set `module` and `moduleResolution` to `NodeNext` in the eight emitted library configurations without changing the global Next/Expo bundler configuration.
- [ ] 2.2 Add `.js` to production relative imports/exports and replace directory specifiers with explicit `index.js` paths.
- [ ] 2.3 Verify package export maps expose existing public roots and `@workout-agent/shared/testing` from built output.
- [ ] 2.4 Add a root `workspace-integrity` Nx project with a `package-imports` target that depends on clean package builds and imports every exported root in plain Node.
- [ ] 2.5 Preserve the dependency-aware server and Docker build graph; fix mobile and any remaining direct development/start entry points that can rely on missing or stale `dist` output.
- [ ] 2.6 Keep barrel splitting, API redesign, and unrelated dependency cleanup outside this PR.

### Acceptance Criteria

- All eight package roots and the shared testing subpath import successfully in Node without custom conditions, loaders, transpilers, or experimental flags.
- Missing or stale package output is rebuilt through Nx dependencies; a missing dependency edge, unresolved built specifier, or missing export fails the smoke target.
- Next and Expo production builds remain green.
- Type declarations continue to resolve from each package's exported `types` entry.

### Verification

```bash
nx run-many -t build --projects=@workout-agent/shared,@workout-agent-ce/server-core,@workout-agent-ce/server-ai,server-auth,server-db,server-exercise-library,metering,quotas
nx run workspace-integrity:package-imports
nx build @workout-agent-ce/server
nx build @workout-agent-ce/mobile
```

## 3. PR 3 - Repair Required Test Signals

**Depends on:** PR 1. It may proceed independently of PR 2.

- [ ] 3.1 Replace the `server-db` `--passWithNoTests` target with real schema/client behavior tests and make an empty suite fail.
- [ ] 3.2 Audit required targets for other no-op, unconditional-pass, or source-mapped checks that fail to exercise production artifacts.
- [ ] 3.3 Keep broad lint-warning cleanup and coverage-percentage policy out of this PR.

### Acceptance Criteria

- Every required test target executes at least one real assertion or is removed from the required target set.

### Verification

```bash
npm ci
nx report
nx test server-db
nx run-many -t lint,typecheck,test,build
```

## 4. PR 4 - Add Critical-Path E2E Coverage

**Depends on:** PR 1, `harden-workout-generation` G1-G3, and `isolate-mobile-account-data` M1-M3. Add M4 only if scoped BYOK is included in the journey.

- [ ] 4.1 Replace example-only server E2E with deterministic capability discovery and generation success/error contract journeys using a mock provider.
- [ ] 4.2 Replace example-only mobile E2E with boot/auth routing, generation, and exact-workout preview navigation journeys.
- [ ] 4.3 Keep E2E independent of live AI providers, RevenueCat, production secrets, and mutable external services.
- [ ] 4.4 Add the E2E targets to the appropriate CI job with failure artifacts sufficient for diagnosis.

### Acceptance Criteria

- The E2E suite fails when a critical API contract or navigation path is intentionally broken.
- Tests run deterministically from a clean checkout using controlled fixtures.
- Server and mobile E2E targets are executable through Nx and enforced in CI.

### Verification

```bash
nx run @workout-agent-ce/server-e2e:e2e
nx run @workout-agent-ce/mobile-e2e:e2e
nx run-many -t lint,typecheck,test,build
```

## 5. Change Verification

**Depends on:** PRs 1-4.

- [ ] 5.1 Run `npm run validate:openspec -- harden-package-and-ci-integrity` successfully.
- [ ] 5.2 Confirm CI invokes `npm run validate:openspec -- --all` rather than a custom wrapper or global OpenSpec installation.
