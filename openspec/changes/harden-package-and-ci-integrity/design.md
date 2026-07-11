## Context

Workspace package exports expose a custom `@workout-agent-ce/source` condition followed by `types`, `import`, and `default` entries. TypeScript asserts the source condition and checks `src` files. Next and Metro select built output but resolve and bundle extensionless or directory imports before Node executes them. Jest also transforms modules through its own resolver, and the server test configuration maps selected packages to source.

Plain Node selects `dist/index.js` and applies strict ESM resolution. It does not append `.js` or resolve a directory to `index.js`, so imports currently fail in `shared`, `server-core`, `server-ai`, and transitively dependent packages. This is not a current Next or Expo outage, but it violates the packages' advertised runtime contract and leaves clean/stale `dist` behavior under-tested.

Origin now includes a checked-in CI workflow with `nx sync:check`, affected lint/test/build targets, and standalone server/migration Docker builds. It still omits typecheck, exact npm setup, full-workspace `main` coverage, and OpenSpec validation. One database test target uses `--passWithNoTests`, and the browser suites provide only shallow example coverage.

## Goals / Non-Goals

**Goals:**

- Make built package exports executable by unmodified Node ESM after a clean dependency-aware build.
- Make pull requests and the main branch prove lint, typecheck, test, build, and package-import integrity automatically.
- Keep application bundlers and TypeScript checking the same implementation that package consumers execute.
- Eliminate green test targets that execute no assertions.
- Establish a small, deterministic critical-path E2E floor.

**Non-Goals:**

- Publishing packages to a public registry.
- Reorganizing shared barrels, moving evaluation code, or changing package public APIs beyond corrections required for valid exports.
- Refactoring application or generation behavior.
- Introducing Nx Cloud, distributed execution, or a broad CI optimization project.
- Clearing all existing lint warnings as part of CI setup.

## Decisions

### 1) Apply NodeNext only to emitted library packages

**Decision:** Configure the eight emitted library `tsconfig.lib.json` files for `module` and `moduleResolution` `NodeNext`, mechanically add `.js` to production relative imports/exports, and replace directory imports with explicit `index.js` paths.

The global TypeScript configuration remains on bundler resolution because Next and Expo are bundler-owned applications. Test configurations may retain resolver-specific settings where required, but production source must compile under Node's runtime rules.

**Alternatives considered:**

- Bundle each library into a single artifact. Rejected because it adds a second bundling layer, complicates native dependencies, and obscures the existing file-based ESM contract.
- Keep bundler resolution and add `--experimental-specifier-resolution=node` to consumers. Rejected because every consumer would need a nonstandard runtime flag and package exports would remain misleading.
- Change the global workspace to NodeNext. Rejected because it would unnecessarily constrain the Expo and Next source toolchains.

### 2) Test package artifacts in plain Node

**Decision:** Add one Nx-owned post-build smoke target that starts a clean Node child process with no custom export condition, loader, transpiler, or experimental resolution flag. It imports:

- `@workout-agent/shared`
- `@workout-agent/shared/testing`
- `@workout-agent-ce/server-core`
- `@workout-agent-ce/server-ai`
- `@workout-agent-ce/server-auth`
- `@workout-agent-ce/server-db`
- `@workout-agent-ce/server-exercise-library`
- `@workout-agent-ce/metering`
- `@workout-agent-ce/quotas`

The target depends on package builds and lands atomically with the ESM corrections so the default branch is never left with a permanently red expected-failure check.

### 3) Use affected CI on pull requests and complete CI on main

**Decision:** Pull requests run Nx affected lint, typecheck, test, and build targets against the merge base, plus the package-import smoke target whenever its inputs or dependencies are affected. Main runs the complete target set to detect graph/configuration mistakes that an affected calculation could miss.

PR 1 updates the runtime contract to Node `>=24.15.0 <25` and npm `>=12 <13`, identifies Node `24.16.0` and npm `12.0.1` as the canonical toolchain, aligns the Nx package versions, and regenerates `package-lock.json` with npm `12.0.1`. Local commands require the canonical Node release but accept npm 12 patch releases; dependency or lockfile changes use the canonical npm release. The Node minimum is tightened because npm 12 requires Node `^24.15.0` on the Node 24 line. CI and both Docker builds install and verify the exact canonical versions before running `npm ci`; the existing `nx sync:check` and Docker jobs remain required.

npm 12 blocks dependency install scripts that are not covered by a project policy. PR 1 uses `npm install-scripts ls` to review every current script, records only necessary version-pinned approvals (and explicit denials where appropriate) in root `allowScripts`, and enables `strict-allow-scripts=true`. It does not use a blanket `--dangerously-allow-all-scripts` escape hatch. CI verifies that a clean install has no unreviewed script and that required native/tooling packages are usable.

OpenSpec validation resolves the exact repository dependency through npm's local binary path. The same thin npm alias accepts a change name for focused local validation or `--all` for full validation. Because full validation is inexpensive, CI validates every active change and canonical spec recognized by the CLI instead of maintaining a custom Git-aware selection wrapper.

Existing lint warnings remain visible but are not converted into a warning-zero migration in the baseline PR.

### 4) Keep test-signal cleanup separate from CI plumbing

**Decision:** The existing workflow is completed in PR 1 without treating current lint warnings as errors. A subsequent PR removes `--passWithNoTests`, adds real server database assertions, and ensures every required target either executes meaningful checks or is not advertised as a test target.

This prevents CI setup from becoming blocked on unrelated warning or coverage cleanup while still recording the required follow-up as part of the same change.

### 5) Add narrow critical-path E2E coverage

**Decision:** Replace example-only server/mobile browser checks with deterministic user journeys backed by controlled local fixtures or mock providers. At minimum, E2E must prove server capability discovery and generation error/success contracts, plus mobile boot, authentication routing, generation, and exact-workout preview navigation.

E2E is a later PR because its stable fixtures depend on the hardened generation and mobile identity contracts. It is not a prerequisite for the package-output correction.

## PR Plan and Dependencies

1. **PR 1 - Pin toolchain and complete existing CI gates**: no prerequisite; upgrades to npm 12, aligns Nx versions, and fills the missing workflow gates while preserving sync and Docker validation.
2. **PR 2 - Correct native ESM package output**: depends on PR 1 for enforcement; may be developed in parallel but lands after CI. It includes the package smoke target atomically.
3. **PR 3 - Repair required test signals**: depends on PR 1 and may proceed independently of PR 2.
4. **PR 4 - Add critical-path E2E coverage**: depends on PR 1, `harden-workout-generation` G1-G3, and `isolate-mobile-account-data` M1-M3. M4 is required only if scoped BYOK becomes part of the initial E2E journey.

PR 2 should land before broad package refactors because its mechanical import edits would otherwise create avoidable conflicts. It is repository hardening, not a prerequisite for deploying the consolidated standalone server.

## Risks / Trade-offs

- [NodeNext reveals a large number of invalid specifiers] -> Keep the PR mechanical, prohibit unrelated refactors, and verify every package root in the smoke target.
- [Next or Metro resolves corrected imports differently] -> Require server and mobile production builds in PR 2 verification.
- [Typechecking source while executing stale `dist`] -> Make consumer targets depend on library builds and test from clean CI checkouts.
- [CI becomes too slow] -> Start with Nx affected tasks on pull requests and optimize only after timing data exists.
- [E2E depends on external AI or billing services] -> Use deterministic mock providers and local fixtures; never require secrets for baseline E2E.

## Migration Plan

There is no user-data or external-consumer migration. Land CI, then change library compilation/import specifiers and their artifact smoke check atomically. Developers with old output can rebuild affected packages; clean CI is authoritative. No compatibility conditions, dual package formats, or rollout flags are required.

## Open Questions

- Should critical mobile coverage remain a web E2E suite or move to a simulator-native harness? The initial PR should select the smallest deterministic path that exercises the actual persistence/navigation contract.
