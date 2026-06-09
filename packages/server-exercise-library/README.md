# @workout-agent-ce/server-exercise-library

Server-only exercise library package for deterministic workout-generation candidate selection.

## Purpose

This package owns the public exercise-library seed, the SQLite build pipeline, and the runtime query layer used by server-side planning.

The committed source-of-truth files are:

- `data/public/canonical-exercises.json`
- `data/catalog/system-workouts.json`
- `data/public/manifest.json`
- `data/curation/overrides.json`
- `data/vocab/*.json`

The package rebuilds `data/public/exercise-library.sqlite` deterministically from those committed inputs. The SQLite file is the server runtime catalog for both canonical exercises and curated system workout recipes.

## Data Flow

1. `data/public/canonical-exercises.json` provides the sanitized public base dataset.
2. `data/curation/overrides.json` applies the small human-editable curation layer.
3. `data/catalog/system-workouts.json` defines curated workout recipes that reference canonical exercise IDs.
4. `scripts/build-canonical.js` writes merged artifacts to `data/generated/` for local validation and reporting.
5. `scripts/build-sqlite.js` rebuilds `data/public/exercise-library.sqlite` from the merged canonical dataset and workout catalog.
6. `src/lib/open-library.ts` opens the public SQLite file through `better-sqlite3`.

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

## Workout Catalog Storage

System workout recipes are stored separately from exercise rows but reference them by stable canonical exercise IDs. This keeps exercises reusable while allowing recipes to own workout-specific ordering, blocks, prescriptions, substitutions, filter tags, constraints, ownership, and version metadata.

`build-sqlite.js` normalizes recipes into `workout_catalog_*` tables:

- `workout_catalog_recipes` stores recipe identity, ownership, version, duration range, experience floor, quality score, and catalog version.
- `workout_catalog_recipe_equipment`, `workout_catalog_recipe_tags`, and `workout_catalog_recipe_constraints` keep filter-critical data relational.
- `workout_catalog_blocks`, `workout_catalog_slots`, and `workout_catalog_slot_substitutions` preserve materialization order and foreign-key every exercise reference back to `exercises(id)`.

The same shape can be recreated in PostgreSQL for hosted/community catalogs: keep canonical exercises in an `exercises` table, copy the `workout_catalog_*` table boundaries, retain foreign keys from slots/substitutions to exercises, and add `owner_user_id` or `community_visibility` columns to `workout_catalog_recipes` when non-system recipes are introduced. Query indexes should mirror the SQLite indexes for duration, experience, equipment, tags, constraints, and slot exercise references.

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
