import { existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function findLatestReportPath() {
  const reportsDir = path.join(process.cwd(), 'reports', 'promptfoo-generation');
  if (!existsSync(reportsDir)) {
    throw new Error('No Promptfoo generation reports found.');
  }

  const reports = readdirSync(reportsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(reportsDir, entry.name, 'report.html'))
    .filter((filePath) => existsSync(filePath))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

  if (reports.length === 0) {
    throw new Error('No Promptfoo generation HTML reports found.');
  }

  return reports[0];
}

function main() {
  const providedPath = process.argv[2];
  const reportPath = providedPath
    ? path.isAbsolute(providedPath)
      ? providedPath
      : path.join(process.cwd(), providedPath)
    : findLatestReportPath();

  if (!existsSync(reportPath)) {
    throw new Error(`Promptfoo generation report not found: ${reportPath}`);
  }

  console.log(`Promptfoo generation report: ${reportPath}`);
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
