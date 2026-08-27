## ADDED Requirements

### Requirement: Automated Workspace Quality Gates

The repository MUST run automated lint, typecheck, test, and build gates for pull requests and the default branch through Nx. Pull-request checks MUST include affected projects and their required dependencies, while the default branch MUST periodically or per push exercise the complete applicable project set. Repository metadata MUST identify exact canonical Node 24 and npm 12 versions. CI and Docker MUST install those exact versions, while ordinary local commands MAY use any npm release in the declared npm 12 range. The declared engine ranges MUST reject incompatible Node patches and npm majors. Dependency install scripts MUST be covered by reviewed, version-pinned approvals or explicit denials; unreviewed scripts MUST fail installation rather than being silently skipped.

#### Scenario: Pull request changes an application dependency

- **GIVEN** a pull request changes a workspace library consumed by an application
- **WHEN** CI calculates affected work
- **THEN** it runs the library's applicable gates and the dependency-required application verification

#### Scenario: CI bootstraps the package manager

- **GIVEN** the repository requires npm 12 on Node 24.15.0 or newer
- **WHEN** a CI job begins dependency installation
- **THEN** it installs and verifies the pinned Node/npm versions before running `npm ci`

#### Scenario: Developer uses another npm 12 patch release

- **GIVEN** a developer uses the canonical Node release and an npm release in the declared npm 12 range that differs from the canonical patch
- **WHEN** npm runs an ordinary source-tree command that does not change dependency or lockfile metadata
- **THEN** the command proceeds without a package-manager engine error

#### Scenario: A required target fails

- **GIVEN** lint, typecheck, test, build, or artifact verification reports a failure
- **WHEN** the CI workflow completes
- **THEN** the workflow fails and does not report the change as ready to merge

#### Scenario: Dependency introduces an unreviewed install script

- **GIVEN** a lockfile change adds or updates a dependency lifecycle script not covered by the repository policy
- **WHEN** CI runs `npm ci` under npm 12
- **THEN** installation fails until the script is deliberately approved at its reviewed version or explicitly denied

#### Scenario: Main branch verifies the complete workspace

- **WHEN** a change reaches the default branch
- **THEN** CI runs the complete applicable Nx target set so graph or affected-calculation mistakes remain detectable

#### Scenario: CI validates OpenSpec planning artifacts

- **GIVEN** the repository contains active OpenSpec changes and canonical specifications
- **WHEN** CI validates repository planning artifacts
- **THEN** it runs full strict validation through the lockfile-pinned CLI rather than a custom wrapper or global executable

### Requirement: Native Node ESM Package Artifacts

Every workspace package that advertises a built ESM export MUST be importable by unmodified Node after a clean dependency-aware build. Runtime package imports MUST NOT require the source export condition, a TypeScript loader, a transpiler, experimental specifier resolution, or bundler-only extension and directory resolution.

#### Scenario: Plain Node imports all public package roots

- **GIVEN** all workspace libraries have completed a clean build
- **WHEN** a Node ESM process imports each package root and `@leveza/shared/testing`
- **THEN** every import resolves from built output and completes without a module-resolution error

#### Scenario: Invalid internal specifier is introduced

- **GIVEN** a built package contains an internal import that Node cannot resolve
- **WHEN** the package-import smoke target runs
- **THEN** the target fails before the artifact can be consumed by the standalone server or another direct Node consumer

#### Scenario: Applications consume corrected artifacts

- **GIVEN** package runtime specifiers comply with Node ESM
- **WHEN** Next and Expo production builds bundle the packages
- **THEN** both application builds continue to succeed without source-only runtime aliases

### Requirement: Build and Source Consistency

Workspace consumers MUST build required library dependencies before executing built package exports. Typechecking source MUST NOT be considered sufficient verification of missing or stale runtime output.

#### Scenario: Consumer runs from a clean checkout

- **GIVEN** no package `dist` directories exist in a clean checkout
- **WHEN** a dependency-aware application or smoke target runs
- **THEN** Nx builds the required packages before the consumer starts

#### Scenario: Package source changes

- **GIVEN** package source changes after an earlier build
- **WHEN** a dependent target executes
- **THEN** Nx invalidates the relevant cached work and the consumer executes output produced from the changed source

### Requirement: Meaningful Required Test Targets

Every test target enforced by CI MUST execute behavior assertions and MUST fail when no tests are discovered unless the project intentionally has no test target. Critical E2E coverage MUST use deterministic fixtures and MUST NOT require live AI, billing, or other production services.

#### Scenario: Test project has no discovered tests

- **GIVEN** a project advertises a required test target
- **WHEN** its runner discovers no tests
- **THEN** the target fails instead of passing through an allow-empty option

#### Scenario: Critical user journey regresses

- **GIVEN** a server API contract or mobile generation/preview journey is broken
- **WHEN** the relevant E2E target runs
- **THEN** the target fails with diagnostic output identifying the broken journey
