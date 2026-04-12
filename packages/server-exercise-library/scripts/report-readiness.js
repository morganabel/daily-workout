import { paths, readJson } from './_common.js';

const report = await readJson(paths.generatedReadinessReport);
const asJson = process.argv.includes('--json');

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const topBlockers = Object.entries(report.blockerCounts ?? {}).slice(0, 8);
const topFamilies = Object.entries(report.countsByFamily ?? {}).slice(0, 8);

console.log('Exercise readiness report');
console.log(
  `Planner-ready: ${report.plannerReadyCount}/${report.totalExercises}`,
);
console.log(`Auto-promoted: ${report.autoPromotedCount}`);
console.log(`Risk tiers: ${JSON.stringify(report.countsByRiskTier)}`);
console.log('Top families:');
for (const [family, count] of topFamilies) {
  console.log(`- ${family}: ${count}`);
}
console.log('Top blockers:');
for (const [blocker, count] of topBlockers) {
  console.log(`- ${blocker}: ${count}`);
}
