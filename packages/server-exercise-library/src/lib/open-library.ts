import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { ExerciseLibraryQueryEngine } from './query.js';
import type { ExerciseLibrary } from './types.js';

export const DEFAULT_LIBRARY_PATH = fileURLToPath(
  new URL('../../data/generated/exercise-library.sqlite', import.meta.url),
);

export interface OpenExerciseLibraryOptions {
  path?: string;
}

export class ExerciseLibraryError extends Error {}

export function openExerciseLibrary(
  options: OpenExerciseLibraryOptions = {},
): ExerciseLibrary {
  const path = options.path ?? DEFAULT_LIBRARY_PATH;

  if (!existsSync(path)) {
    throw new ExerciseLibraryError(
      `Exercise library not found at ${path}. Run \`nx run server-exercise-library:build-db\` first.`,
    );
  }

  const database = new Database(path, {
    readonly: true,
    fileMustExist: true,
  });

  return new ExerciseLibraryQueryEngine(database);
}
