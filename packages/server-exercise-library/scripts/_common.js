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
  publicDir: path.join(packageRoot, 'data', 'public'),
  vocabDir: path.join(packageRoot, 'data', 'vocab'),
  curationDir: path.join(packageRoot, 'data', 'curation'),
  generatedDir: path.join(packageRoot, 'data', 'generated'),
  publicCanonical: path.join(
    packageRoot,
    'data',
    'public',
    'canonical-exercises.json',
  ),
  publicManifest: path.join(packageRoot, 'data', 'public', 'manifest.json'),
  publicSqlite: path.join(
    packageRoot,
    'data',
    'public',
    'exercise-library.sqlite',
  ),
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
  generatedSqliteTemp: path.join(
    packageRoot,
    'data',
    'generated',
    'exercise-library.sqlite.next',
  ),
  generatedReadinessReport: path.join(
    packageRoot,
    'data',
    'generated',
    'readiness-report.json',
  ),
};

export async function ensureDirectories() {
  await Promise.all(
    [
      paths.publicDir,
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
