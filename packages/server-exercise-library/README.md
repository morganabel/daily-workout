# @workout-agent-ce/server-exercise-library

Server-only exercise library package for deterministic workout-generation candidate selection.

## Purpose

This package owns the public exercise-library seed, the SQLite build pipeline, and the runtime query layer used by server-side planning.

The committed source-of-truth files are:

- `data/public/canonical-exercises.json`
- `data/public/manifest.json`
- `data/curation/overrides.json`
- `data/vocab/*.json`

The package rebuilds `data/public/exercise-library.sqlite` deterministically from those committed inputs.

## Data Flow

1. `data/public/canonical-exercises.json` provides the sanitized public base dataset.
2. `data/curation/overrides.json` applies the small human-editable curation layer.
3. `scripts/build-canonical.js` writes merged artifacts to `data/generated/` for local validation and reporting.
4. `scripts/build-sqlite.js` rebuilds `data/public/exercise-library.sqlite` from the merged canonical dataset.
5. `src/lib/open-library.ts` opens the public SQLite file through `better-sqlite3`.

## Provenance Rules

- Existing `free-exercise-db` records keep stable `fedb:*` exercise IDs and explicit `sourceRefs`.
- Sanitized public-seed records use stable public `ex:*` IDs and public slugs.
- Non-`fedb` public records keep `sourceRefs: []` and do not expose private crawl metadata.

## Metadata Completeness

Every exercise record gets a `metadataCompleteness` value:

- `raw`
- `derived`
- `curated`
- `planner-ready`

Production candidate-pool queries default to `planner-ready` records only.

`data/generated/readiness-report.json` summarizes the current readiness distribution and top blockers after overrides are applied.

The query engine supports hybrid retrieval:

- hard filters over normalized SQLite columns and join tables
- optional BM25 ranking through an FTS5 search index

BM25 only ranks exercises that already satisfy the hard filters.

## Commands

Build the merged canonical dataset:

```bash
node packages/server-exercise-library/scripts/build-canonical.js
```

Build the SQLite database:

```bash
node packages/server-exercise-library/scripts/build-sqlite.js
```

Print the readiness report:

```bash
NX_DAEMON=false ./node_modules/.bin/nx run server-exercise-library:report-readiness
```

Validate the library:

```bash
NX_DAEMON=false ./node_modules/.bin/nx run server-exercise-library:validate-library
```

Run package tests:

```bash
NX_DAEMON=false ./node_modules/.bin/nx test server-exercise-library
```

## Notes

- Temporary validation artifacts live under `data/generated/` and are git-ignored.
- `data/public/exercise-library.sqlite` is the runtime artifact opened by the package.
- Future hand edits should usually go into `data/curation/overrides.json`, not directly into the public canonical seed.
