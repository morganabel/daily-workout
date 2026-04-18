import { existsSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { ExerciseLibraryQueryEngine } from './query.js';
import type { ExerciseLibrary } from './types.js';

const defaultLibraryUrl = new URL(
  '../../data/generated/exercise-library.sqlite',
  import.meta.url,
);

function toFileSystemPath(url: URL): string {
  const pathname = decodeURIComponent(url.pathname);

  if (process.platform === 'win32' && /^\/[A-Za-z]:/.test(pathname)) {
    return pathname.slice(1);
  }

  return pathname;
}

export const DEFAULT_LIBRARY_PATH = toFileSystemPath(defaultLibraryUrl);

export interface OpenExerciseLibraryOptions {
  path?: string;
}

export class ExerciseLibraryError extends Error {}

const WORKSPACE_LIBRARY_PATH = path.join(
  'packages',
  'server-exercise-library',
  'data',
  'generated',
  'exercise-library.sqlite',
);

const LOCAL_LIBRARY_PATH = path.join(
  'data',
  'generated',
  'exercise-library.sqlite',
);

function resolveDefaultLibraryPath(): string {
  if (existsSync(DEFAULT_LIBRARY_PATH)) {
    return DEFAULT_LIBRARY_PATH;
  }

  let currentDir = process.cwd();

  for (let depth = 0; depth < 6; depth += 1) {
    const localCandidate = path.join(currentDir, LOCAL_LIBRARY_PATH);
    if (existsSync(localCandidate)) {
      return localCandidate;
    }

    const workspaceCandidate = path.join(currentDir, WORKSPACE_LIBRARY_PATH);
    if (existsSync(workspaceCandidate)) {
      return workspaceCandidate;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  return DEFAULT_LIBRARY_PATH;
}

export function openExerciseLibrary(
  options: OpenExerciseLibraryOptions = {},
): ExerciseLibrary {
  const libraryPath = options.path ?? resolveDefaultLibraryPath();

  if (!existsSync(libraryPath)) {
    throw new ExerciseLibraryError(
      `Exercise library not found at ${libraryPath}. Run \`nx run server-exercise-library:build-db\` first.`,
    );
  }

  const database = new Database(libraryPath, {
    readonly: true,
    fileMustExist: true,
  });

  return new ExerciseLibraryQueryEngine(database);
}
