import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

export const paths = {
  packageRoot,
  dataDir: path.join(packageRoot, 'data'),
  sourceDir: path.join(packageRoot, 'data', 'source'),
  vocabDir: path.join(packageRoot, 'data', 'vocab'),
  curationDir: path.join(packageRoot, 'data', 'curation'),
  generatedDir: path.join(packageRoot, 'data', 'generated'),
  sourceSnapshot: path.join(
    packageRoot,
    'data',
    'source',
    'free-exercise-db.snapshot.json',
  ),
  sourceManifest: path.join(packageRoot, 'data', 'source-manifest.json'),
  equipmentVocab: path.join(packageRoot, 'data', 'vocab', 'equipment.json'),
  enumsVocab: path.join(packageRoot, 'data', 'vocab', 'enums.json'),
  tagsVocab: path.join(packageRoot, 'data', 'vocab', 'tags.json'),
  overrides: path.join(packageRoot, 'data', 'curation', 'overrides.json'),
  generatedCanonical: path.join(
    packageRoot,
    'data',
    'generated',
    'canonical-exercises.json',
  ),
  generatedManifest: path.join(
    packageRoot,
    'data',
    'generated',
    'manifest.json',
  ),
  generatedSqlite: path.join(
    packageRoot,
    'data',
    'generated',
    'exercise-library.sqlite',
  ),
  generatedSqliteTemp: path.join(
    packageRoot,
    'data',
    'generated',
    'exercise-library.sqlite.next',
  ),
};

export async function ensureDirectories() {
  await Promise.all(
    [
      paths.sourceDir,
      paths.vocabDir,
      paths.curationDir,
      paths.generatedDir,
    ].map((target) => mkdir(target, { recursive: true })),
  );
}

export async function readJson(filePath) {
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content);
}

export async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeTag(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
