import { existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function findLatestReportPath() {
  const reportsDir = path.join(process.cwd(), 'reports', 'promptfoo-generation');
  if (!existsSync(reportsDir)) {
    throw new Error('No Promptfoo generation reports found.');
  }

  const reportDirs = readdirSync(reportsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(reportsDir, entry.name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

  const reports = reportDirs
    .flatMap((reportDir) => [
      path.join(reportDir, 'comparison.html'),
      path.join(reportDir, 'report.html'),
    ])
    .filter((filePath) => existsSync(filePath));

  if (reports.length === 0) {
    throw new Error('No Promptfoo generation comparison or HTML reports found.');
  }

  return reports[0];
}

function resolveReportPath(providedPath) {
  const candidatePath = path.isAbsolute(providedPath)
    ? providedPath
    : path.join(process.cwd(), providedPath);

  if (!existsSync(candidatePath)) {
    return candidatePath;
  }

  if (!statSync(candidatePath).isDirectory()) {
    return candidatePath;
  }

  const comparisonPath = path.join(candidatePath, 'comparison.html');
  if (existsSync(comparisonPath)) {
    return comparisonPath;
  }

  return path.join(candidatePath, 'report.html');
}

function main() {
  const providedPath = process.argv[2];
  const reportPath = providedPath ? resolveReportPath(providedPath) : findLatestReportPath();

  if (!existsSync(reportPath)) {
    throw new Error(`Promptfoo generation report not found: ${reportPath}`);
  }

  console.log(`Promptfoo generation report: ${reportPath}`);
  console.log(`Promptfoo generation report URL: ${pathToFileURL(reportPath).href}`);
  if (process.platform === 'darwin') {
    spawnSync('open', [reportPath], { stdio: 'ignore', shell: false });
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
