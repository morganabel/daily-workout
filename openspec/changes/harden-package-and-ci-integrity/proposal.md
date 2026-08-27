## Why

The workspace now has an initial GitHub Actions workflow that runs `nx sync:check`, affected lint/test/build targets, and standalone Docker builds. It does not yet run typecheck, verify an exact Node/npm toolchain, exercise the complete workspace on `main`, or validate OpenSpec artifacts. Local Nx builds and application bundles also do not prove that emitted workspace packages satisfy the native Node ESM contract advertised by their `package.json` exports. Plain Node imports of several `dist` entry points fail on extensionless or directory imports that TypeScript, Jest, Next, and Metro resolve permissively.

This creates two forms of false confidence: application bundlers can hide invalid package artifacts, and targets such as the database test target can pass without executing assertions. This repository now builds the canonical standalone server image, so package correctness and repeatable repository gates are repository-integrity requirements rather than a prerequisite for a separate code-bearing hosted overlay.

## What Changes

- Complete the existing pull-request and main-branch CI using dependency-aware Nx targets for lint, typecheck, test, and build while preserving `nx sync:check` and both Docker image builds.
- Upgrade the repository contract to npm 12 on a compatible Node 24 patch release, publish exact canonical toolchain versions, enforce them in CI and Docker, accept npm 12 patch releases for ordinary local commands, and regenerate the lockfile with the canonical npm release.
- Audit npm 12's blocked dependency install scripts, commit narrowly version-pinned approvals or explicit denials, and make unreviewed scripts fail CI instead of silently producing incomplete native/tooling installs.
- Pin the repository's OpenSpec CLI and expose one thin npm alias for focused or full strict validation so planning artifacts are verifiable without a custom wrapper or global executable.
- Make every exported workspace package valid native Node ESM by using Node-targeted TypeScript resolution and explicit runtime import specifiers.
- Add a mandatory post-build smoke target that imports all eight package roots plus `@leveza/shared/testing` in plain Node without custom conditions or experimental resolution flags.
- Ensure development and application build entry points cannot silently execute missing or stale package output.
- Align Nx toolchain versions and remove false-positive test targets that pass without tests.
- Replace example-only browser checks with a small set of deterministic critical-path E2E tests.

## Capabilities

### New Capabilities

- `repository-integrity`: Defines required CI gates, native ESM package behavior, build/source consistency, and minimum meaningful automated test signals.

### Modified Capabilities

- None. This change strengthens repository and distribution contracts without changing workout behavior or user-facing APIs.

## Impact

- Affected configuration: `.github/workflows`, Dockerfiles, `.npmrc`, root package/toolchain metadata, `nx.json`, root scripts, package TypeScript build configuration, and package exports where necessary.
- Affected packages: `shared`, `server-core`, `server-ai`, `server-auth`, `server-db`, `server-exercise-library`, `metering`, and `quotas`.
- Affected tests: workspace package-import smoke checks, database package tests, and server/mobile E2E projects.
- Deployment modes: self-hosted and hosted behavior is unchanged. The canonical server build and any direct package consumer gain a reliable package contract and CI gate.
- Compatibility: there are no external users or published package consumers, so build configuration and internal import specifiers can change directly without a compatibility layer.
