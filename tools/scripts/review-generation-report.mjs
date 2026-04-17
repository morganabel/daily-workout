import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const reviewDimensionLabels = [
  'clarity',
  'plausibility',
  'novelty',
  'appeal',
  'goal-fit',
];

const reviewBatchSchema = z.object({
  reviews: z.array(
    z.object({
      runId: z.string(),
      verdict: z.enum(['accept', 'revise', 'reject']),
      confidence: z.number().int().min(1).max(5),
      scores: z.array(
        z.object({
          dimension: z.enum(reviewDimensionLabels),
          score: z.number().int().min(1).max(5),
          rationale: z.string().min(1).max(220),
        })
      ).length(reviewDimensionLabels.length),
      strengths: z.array(z.string().min(1).max(140)).max(3),
      issues: z.array(z.string().min(1).max(140)).max(3),
      suggestedAdjustments: z.array(z.string().min(1).max(160)).max(3),
      notes: z.string().min(1).max(280),
    })
  ),
});

function loadRepoEnv() {
  const candidates = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), 'apps', 'server', '.env'),
    path.join(process.cwd(), 'apps', 'server', '.env.local'),
  ];

  for (const filePath of candidates) {
    if (existsSync(filePath)) {
      process.loadEnvFile(filePath);
    }
  }
}

function parseArgs(argv) {
  let reportPath;
  let chunkSize = 8;
  let limit;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--report' && next) {
      reportPath = path.isAbsolute(next) ? next : path.join(process.cwd(), next);
      i += 1;
      continue;
    }
    if (arg === '--chunk-size' && next) {
      chunkSize = Number.parseInt(next, 10);
      i += 1;
      continue;
    }
    if (arg === '--limit' && next) {
      limit = Number.parseInt(next, 10);
      i += 1;
    }
  }

  return { reportPath, chunkSize, limit };
}

function findLatestReportPath() {
  const reportsDir = path.join(process.cwd(), 'reports', 'generation-evaluation');
  const subdirs = readdirSync(reportsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(reportsDir, entry.name, 'report.json'))
    .filter((filePath) => existsSync(filePath))
    .sort(
      (a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs
    );

  if (subdirs.length === 0) {
    throw new Error('No generation evaluation reports found.');
  }

  return subdirs[0];
}

function compactEntry(entry) {
  return {
    runId: entry.runId,
    scenarioId: entry.scenarioId,
    title: entry.scenarioTitle,
    description: entry.scenarioDescription,
    tags: entry.scenarioTags,
    mode: entry.scenarioMode,
    request: entry.request,
    context: entry.context
      ? {
          userProfile: entry.context.userProfile,
          preferences: entry.context.preferences,
          environment: entry.context.environment,
          recentSessions: entry.context.recentSessions?.map((session) => ({
            name: session.name,
            focus: session.focus,
            durationMinutes: session.durationMinutes,
            perceivedEffort: session.perceivedEffort,
          })),
          notes: entry.context.notes,
        }
      : undefined,
    baselinePlan: entry.baselinePlan
      ? {
          focus: entry.baselinePlan.focus,
          durationMinutes: entry.baselinePlan.durationMinutes,
          summary: entry.baselinePlan.summary,
          exerciseNames: entry.baselinePlan.blocks.flatMap((block) =>
            block.exercises.map((exercise) => exercise.name)
          ),
        }
      : undefined,
    plan: entry.plan
      ? {
          focus: entry.plan.focus,
          durationMinutes: entry.plan.durationMinutes,
          equipment: entry.plan.equipment,
          energy: entry.plan.energy,
          summary: entry.plan.summary,
          blocks: entry.plan.blocks.map((block) => ({
            title: block.title,
            durationMinutes: block.durationMinutes,
            focus: block.focus,
            exerciseNames: block.exercises.map((exercise) => exercise.name),
            prescriptions: block.exercises.map((exercise) => ({
              name: exercise.name,
              prescription: exercise.prescription,
            })),
          })),
        }
      : undefined,
  };
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function reviewChunk(client, chunkEntries, model) {
  const prompt = [
    'You are an exacting product reviewer for AI-generated workouts.',
    'Review each workout against the user scenario and decide whether it feels useful, specific, motivating, and well-targeted.',
    'Score five dimensions from 1-5: clarity, plausibility, novelty, appeal, goal-fit.',
    'Use verdicts:',
    '- accept: strong enough to ship as-is',
    '- revise: usable but should be improved',
    '- reject: poor fit or low quality',
    'Do not focus on schema correctness or hard-rule checks; those already ran separately.',
    'Be concise, specific, and slightly demanding.',
    'Return a review for every runId exactly once.',
    '',
    JSON.stringify(chunkEntries, null, 2),
  ].join('\n');

  const response = await client.responses.parse({
    model,
    reasoning: { effort: 'low' },
    input: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    text: {
      format: zodTextFormat(reviewBatchSchema, 'generation_report_review_batch'),
    },
  });

  return response.output_parsed.reviews;
}

function buildReviewSummary(reviews) {
  const verdictCounts = reviews.reduce(
    (acc, review) => {
      acc[review.verdict] = (acc[review.verdict] ?? 0) + 1;
      return acc;
    },
    { accept: 0, revise: 0, reject: 0 }
  );

  const dimensionAverages = Object.fromEntries(
    reviewDimensionLabels.map((dimension) => [
      dimension,
      Number(
        average(
          reviews.map(
            (review) =>
              review.scores.find((score) => score.dimension === dimension)?.score ?? 0
          )
        ).toFixed(2)
      ),
    ])
  );

  const withOverall = reviews.map((review) => ({
    ...review,
    averageScore: Number(
      average(review.scores.map((score) => score.score)).toFixed(2)
    ),
  }));

  const lowest = [...withOverall]
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 12)
    .map((review) => ({
      runId: review.runId,
      verdict: review.verdict,
      averageScore: review.averageScore,
      issues: review.issues,
      suggestedAdjustments: review.suggestedAdjustments,
    }));

  const issueCounts = new Map();
  reviews.forEach((review) => {
    review.issues.forEach((issue) => {
      issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
    });
  });

  const recurringIssues = [...issueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([issue, count]) => ({ issue, count }));

  return {
    verdictCounts,
    dimensionAverages,
    lowest,
    recurringIssues,
  };
}

function renderMarkdown(reviewReport) {
  const lines = [
    '# AI Review Of Generation Report',
    '',
    `- Source report: ${reviewReport.sourceReport}`,
    `- Reviewed at: ${reviewReport.reviewedAt}`,
    `- Reviewer model: ${reviewReport.reviewer.model}`,
    `- Entries reviewed: ${reviewReport.summary.totalReviews}`,
    '',
    '## Verdict Counts',
    '',
    `- Accept: ${reviewReport.summary.verdictCounts.accept}`,
    `- Revise: ${reviewReport.summary.verdictCounts.revise}`,
    `- Reject: ${reviewReport.summary.verdictCounts.reject}`,
    '',
    '## Dimension Averages',
    '',
  ];

  for (const [dimension, score] of Object.entries(reviewReport.summary.dimensionAverages)) {
    lines.push(`- ${dimension}: ${score}`);
  }

  lines.push('', '## Lowest Rated Runs', '');
  reviewReport.summary.lowest.forEach((item) => {
    lines.push(`- ${item.runId}: ${item.averageScore} (${item.verdict})`);
    item.issues.forEach((issue) => lines.push(`  - issue: ${issue}`));
    item.suggestedAdjustments.forEach((adj) => lines.push(`  - fix: ${adj}`));
  });

  lines.push('', '## Recurring Issues', '');
  reviewReport.summary.recurringIssues.forEach((item) => {
    lines.push(`- ${item.issue}: ${item.count}`);
  });

  return lines.join('\n');
}

async function main() {
  loadRepoEnv();
  const { reportPath: providedReportPath, chunkSize, limit } = parseArgs(
    process.argv.slice(2)
  );

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required to run AI review.');
  }

  const reportPath = providedReportPath ?? findLatestReportPath();
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const entries = limit ? report.entries.slice(0, limit) : report.entries;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_REVIEW_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-5.4-mini';

  const entryChunks = chunk(entries.map(compactEntry), chunkSize);
  const reviews = [];

  for (const entryChunk of entryChunks) {
    const chunkReviews = await reviewChunk(client, entryChunk, model);
    reviews.push(...chunkReviews);
    console.log(`Reviewed ${reviews.length}/${entries.length} entries`);
  }

  const reviewSummary = buildReviewSummary(reviews);
  const reviewReport = {
    sourceReport: reportPath,
    reviewedAt: new Date().toISOString(),
    reviewer: {
      provider: 'openai',
      model,
    },
    summary: {
      totalReviews: reviews.length,
      ...reviewSummary,
    },
    reviews,
  };

  const outputDir = path.dirname(reportPath);
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'ai-review.json');
  const markdownPath = path.join(outputDir, 'ai-review.md');

  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(reviewReport, null, 2)}\n`, 'utf8'),
    writeFile(markdownPath, `${renderMarkdown(reviewReport)}\n`, 'utf8'),
  ]);

  console.log(`AI review JSON: ${jsonPath}`);
  console.log(`AI review Markdown: ${markdownPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
