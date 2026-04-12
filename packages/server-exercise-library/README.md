# @workout-agent-ce/server-exercise-library

Server-only exercise library package for deterministic workout-generation candidate selection.

## Purpose

This package owns the exercise-library data pipeline and the runtime query layer used by server-side planning.

It builds a local SQLite database from committed source inputs:

- a reduced pinned snapshot of `free-exercise-db`
- local vocabularies
- local curation overrides

The generated SQLite artifact is not committed. It is rebuilt locally and in CI from the committed inputs.

## Data Flow

1. `data/source/free-exercise-db.snapshot.json`
2. `data/source-manifest.json`
3. `data/vocab/*.json`
4. `data/curation/overrides.json`
5. `scripts/build-canonical.js` generates `data/generated/canonical-exercises.json`
6. `scripts/build-sqlite.js` generates `data/generated/exercise-library.sqlite`
7. `src/lib/open-library.ts` opens the generated SQLite file through `better-sqlite3`

Only the inputs in steps 1-4 are source-of-truth files.

## Metadata Completeness

Every exercise record gets a `metadataCompleteness` value:

- `raw`
- `derived`
- `curated`
- `planner-ready`

Production candidate-pool queries default to `planner-ready` records only.

The query engine supports hybrid retrieval:

- hard filters over normalized SQLite columns/join tables
- optional BM25 ranking through an FTS5 search index

BM25 only ranks exercises that already satisfy the hard filters.

## Commands

Refresh the pinned upstream snapshot:

```bash
node packages/server-exercise-library/scripts/import-upstream.js
```

Build the canonical merged dataset:

```bash
node packages/server-exercise-library/scripts/build-canonical.js
```

Build the SQLite database:

```bash
node packages/server-exercise-library/scripts/build-sqlite.js
```

Validate the generated library:

```bash
NX_DAEMON=false ./node_modules/.bin/nx run server-exercise-library:validate-library
```

Run package tests:

```bash
NX_DAEMON=false ./node_modules/.bin/nx test server-exercise-library
```

## Notes

- The generated artifacts live under `data/generated/` and are git-ignored.
- The current curated subset is intentionally small; imported records remain in the library with lower completeness until they are reviewed.
