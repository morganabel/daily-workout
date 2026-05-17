import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  InMemoryGenerationStore,
  StubAuthProvider,
  createGenerateHandler,
  runHardChecksForScenario,
  summarizeHardFailures,
  type ModelGenerationOptions,
  type ModelPromptCapture,
  type ModelRouter,
  type StageOnePlanner,
  type StageOnePlanningOptions,
  type StageOnePlannerArtifact,
} from '@workout-agent-ce/server-core';
import {
  DefaultModelRouter,
  DefaultStageOnePlanner,
} from '@workout-agent-ce/server-ai';
import {
  generationEvaluationReportSchema,
  type GenerationEvaluationAverageLatency,
  type GenerationEvaluationExecutionSource,
  type GenerationEvaluationLatency,
  type GenerationEvaluationProvider,
  type GenerationEvaluationPlannerSummary,
  type GenerationEvaluationProviderPrompt,
  type GenerationEvaluationReport,
  type GenerationEvaluationReportEntry,
  type GenerationEvaluationScenario,
  type GenerationContext,
  type GenerationRequest,
  workoutGenerationEvaluationCorpus,
  workoutGenerationEvaluationScenarios,
} from '@workout-agent/shared';
import { createTodayPlanFixture } from '@workout-agent/shared/testing';

export type GenerationEvaluationRunOptions = {
  providers: GenerationEvaluationProvider[];
  runs: number;
  edition: 'CE' | 'HOSTED';
  outputDir: string;
  scenarioIds?: string[];
  tags?: string[];
  limit?: number;
};

export type GenerationEvaluationArtifacts = {
  html: string;
  json: string;
  jsonl: string;
  markdown: string;
  summary: string;
};

export type GenerationEvaluationRunResult = {
  report: GenerationEvaluationReport;
  warnings: string[];
  artifacts: GenerationEvaluationArtifacts;
};

type HandlerBundle = {
  handler: ReturnType<typeof createGenerateHandler>;
  store: InMemoryGenerationStore;
  hasConfiguredAccess: boolean;
  router: PromptCapturingRouter;
  planner: PromptCapturingStageOnePlanner;
};

type ExecutedScenarioResult = {
  responseStatus: number;
  payload: unknown;
  executionSource: GenerationEvaluationExecutionSource;
  stateHasPlan: boolean;
  latencyMs: GenerationEvaluationLatency;
  plannerSummary: GenerationEvaluationPlannerSummary;
  providerPrompt?: GenerationEvaluationProviderPrompt;
};

type PromptCaptureResult = {
  prompt?: GenerationEvaluationProviderPrompt;
  durationMs?: number;
};

type StageOneCaptureResult = {
  summary: GenerationEvaluationPlannerSummary;
  durationMs?: number;
};

class PromptCapturingRouter implements ModelRouter {
  private readonly inner = new DefaultModelRouter();
  private lastPrompt?: GenerationEvaluationProviderPrompt;
  private lastDurationMs?: number;

  constructor(private readonly fixtureMode = false) {}

  async generate(
    request: GenerationRequest,
    context: GenerationContext,
    options: ModelGenerationOptions
  ) {
    this.lastPrompt = undefined;
    this.lastDurationMs = undefined;
    const startedAt = Date.now();

    try {
      if (this.fixtureMode) {
        const fixtureId = Date.now();
        return {
          plan: createTodayPlanFixture({
            id: `fixture-plan-${fixtureId}`,
            durationMinutes: request.timeMinutes ?? 30,
            focus: request.focus ?? 'Full Body',
            equipment: request.equipment ?? ['Bodyweight'],
            energy: request.energy ?? 'moderate',
          }),
          responseId: `fixture-response-${fixtureId}`,
          schemaVersion: 'fixture',
        };
      }

      return await this.inner.generate(request, context, {
        ...options,
        promptRecorder: (capture: ModelPromptCapture) => {
          this.lastPrompt = capture;
          options.promptRecorder?.(capture);
        },
      });
    } finally {
      this.lastDurationMs = Date.now() - startedAt;
    }
  }

  isSupportedProvider(provider: string): boolean {
    return this.inner.isSupportedProvider(provider);
  }

  getDefaultProvider(): string {
    return this.inner.getDefaultProvider();
  }

  consumeLastCapture(): PromptCaptureResult {
    const prompt = this.lastPrompt;
    const durationMs = this.lastDurationMs;
    this.lastPrompt = undefined;
    this.lastDurationMs = undefined;
    return { prompt, durationMs };
  }
}

class PromptCapturingStageOnePlanner implements StageOnePlanner {
  private readonly inner = new DefaultStageOnePlanner();
  private lastPrompt?: GenerationEvaluationProviderPrompt;
  private lastArtifact?: StageOnePlannerArtifact;
  private lastDurationMs?: number;

  async plan(
    request: GenerationRequest,
    context: GenerationContext,
    options: StageOnePlanningOptions
  ) {
    this.lastPrompt = undefined;
    this.lastArtifact = undefined;
    this.lastDurationMs = undefined;
    const startedAt = Date.now();

    try {
      const artifact = await this.inner.plan(request, context, {
        ...options,
        promptRecorder: (capture: ModelPromptCapture) => {
          this.lastPrompt = capture;
          options.promptRecorder?.(capture);
        },
      });
      this.lastArtifact = artifact;
      return artifact;
    } finally {
      this.lastDurationMs = Date.now() - startedAt;
    }
  }

  consumeLastCapture(): StageOneCaptureResult {
    const summary: GenerationEvaluationPlannerSummary = {
      usedStageOne: Boolean(this.lastArtifact),
      artifact: this.lastArtifact,
      stageOnePrompt: this.lastPrompt,
    };
    const durationMs = this.lastDurationMs;
    this.lastPrompt = undefined;
    this.lastArtifact = undefined;
    this.lastDurationMs = undefined;
    return { summary, durationMs };
  }
}

function selectScenarios(options: GenerationEvaluationRunOptions) {
  let scenarios = workoutGenerationEvaluationScenarios;

  if (options.scenarioIds && options.scenarioIds.length > 0) {
    const selected = new Set(options.scenarioIds);
    scenarios = scenarios.filter((scenario) => selected.has(scenario.id));
  }

  if (options.tags && options.tags.length > 0) {
    const requiredTags = new Set(options.tags);
    scenarios = scenarios.filter((scenario) =>
      Array.from(requiredTags).every((tag) => scenario.tags.includes(tag))
    );
  }

  if (options.limit !== undefined) {
    scenarios = scenarios.slice(0, options.limit);
  }

  if (scenarios.length === 0) {
    throw new Error('No scenarios matched the provided filters.');
  }

  return scenarios;
}

function createHandlerBundle(
  provider: GenerationEvaluationProvider,
  edition: 'CE' | 'HOSTED'
): HandlerBundle {
  const store = new InMemoryGenerationStore();
  const isFixtureProvider = provider === 'fixture';
  const router = new PromptCapturingRouter(isFixtureProvider);
  const planner = new PromptCapturingStageOnePlanner();
  const useVertexAi = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
  const enableStageOnePlanner =
    process.env.ENABLE_STAGE_ONE_PLANNER !== 'false';
  const hasGeminiAccess = Boolean(process.env.GEMINI_API_KEY) || useVertexAi;
  const hasConfiguredAccess = isFixtureProvider
    ? true
    : provider === 'openai'
    ? Boolean(process.env.OPENAI_API_KEY)
    : hasGeminiAccess;

  return {
    handler: createGenerateHandler({
      auth: new StubAuthProvider(),
      store,
      router,
      planner,
      config: {
        edition,
        defaultProvider: isFixtureProvider ? 'openai' : provider,
        defaultApiKeys: isFixtureProvider
          ? { openai: 'fixture-provider-key' }
          : {
              openai: process.env.OPENAI_API_KEY,
              gemini: process.env.GEMINI_API_KEY,
            },
        enableStageOnePlanner,
        useVertexAi,
        googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT,
        googleCloudLocation: process.env.GOOGLE_CLOUD_LOCATION,
      },
    }),
    store,
    hasConfiguredAccess,
    planner,
    router,
  };
}

function buildHeaders(provider: GenerationEvaluationProvider, runId: string) {
  const headers: Record<string, string> = {
    authorization: `Bearer ${runId}`,
    'content-type': 'application/json',
  };

  if (provider === 'openai' || provider === 'gemini') {
    headers['x-ai-provider'] = provider;
  }

  return headers;
}

function parseErrorPayload(payload: unknown): {
  code?: string;
  message?: string;
} {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const record = payload as Record<string, unknown>;
  if ('error' in record && record.error && typeof record.error === 'object') {
    const nested = record.error as Record<string, unknown>;
    return {
      code: typeof nested.code === 'string' ? nested.code : undefined,
      message: typeof nested.message === 'string' ? nested.message : undefined,
    };
  }

  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    message: typeof record.message === 'string' ? record.message : undefined,
  };
}

function buildRequestBody(scenario: GenerationEvaluationScenario) {
  return scenario.context
    ? { ...scenario.request, context: scenario.context }
    : scenario.request;
}

function buildPrimingRequest(scenario: GenerationEvaluationScenario) {
  const { previousResponseId, feedback, notes, ...request } = scenario.request;

  return scenario.context ? { ...request, context: scenario.context } : request;
}

function executionSourceForRun(params: {
  provider: GenerationEvaluationProvider;
  edition: 'CE' | 'HOSTED';
  hasConfiguredAccess: boolean;
  responseStatus: number;
  stateHasPlan: boolean;
}): GenerationEvaluationExecutionSource {
  if (params.provider === 'fixture') {
    return 'fixture';
  }
  return 'live';
}

async function executeScenarioRequest(params: {
  bundle: HandlerBundle;
  provider: GenerationEvaluationProvider;
  edition: 'CE' | 'HOSTED';
  token: string;
  body: unknown;
}): Promise<ExecutedScenarioResult> {
  params.bundle.router.consumeLastCapture();
  params.bundle.planner.consumeLastCapture();
  const request = new Request('http://localhost/api/workouts/generate', {
    method: 'POST',
    headers: buildHeaders(params.provider, params.token),
    body: JSON.stringify(params.body),
  });

  const requestStartedAt = Date.now();
  const response = await params.bundle.handler(request);
  const totalRequestMs = Date.now() - requestStartedAt;
  const payload = await response.json();
  const state = await params.bundle.store.getState(params.token);
  const plannerCapture = params.bundle.planner.consumeLastCapture();
  const generationCapture = params.bundle.router.consumeLastCapture();

  return {
    responseStatus: response.status,
    payload,
    executionSource: executionSourceForRun({
      provider: params.provider,
      edition: params.edition,
      hasConfiguredAccess: params.bundle.hasConfiguredAccess,
      responseStatus: response.status,
      stateHasPlan: Boolean(state.plan),
    }),
    stateHasPlan: Boolean(state.plan),
    latencyMs: {
      totalRequestMs,
      stageOnePlannerMs: plannerCapture.durationMs,
      stageTwoGenerationMs: generationCapture.durationMs,
    },
    plannerSummary: plannerCapture.summary,
    providerPrompt: generationCapture.prompt,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function pushUniqueWarning(warnings: string[], warning: string) {
  if (!warnings.includes(warning)) {
    warnings.push(warning);
  }
}

function buildPlanOverview(entry: GenerationEvaluationReportEntry): string {
  if (!entry.plan) {
    return 'No plan generated';
  }
  return `${entry.plan.focus} - ${
    entry.plan.durationMinutes
  } min - ${entry.plan.equipment.join(', ')}`;
}

function renderPlanDetailsHtml(entry: GenerationEvaluationReportEntry): string {
  if (!entry.plan) {
    return '<p class="muted">No plan available for this run.</p>';
  }

  const equipment =
    entry.plan.equipment.length > 0 ? entry.plan.equipment : ['Bodyweight'];

  const blockCards = entry.plan.blocks
    .map(
      (block) => `
        <article class="plan-block">
          <div class="plan-block-header">
            <div>
              <h5>${escapeHtml(block.title)}</h5>
              <p>${escapeHtml(block.focus)}</p>
            </div>
            <span class="plan-block-time">${block.durationMinutes} min</span>
          </div>
          <ol class="plan-exercise-list">
            ${block.exercises
              .map(
                (exercise) => `
                  <li class="plan-exercise-item">
                    <div class="plan-exercise-name">${escapeHtml(
                      exercise.name
                    )}</div>
                    <div class="plan-exercise-prescription">${escapeHtml(
                      exercise.prescription
                    )}</div>
                    ${
                      exercise.detail
                        ? `<div class="plan-exercise-detail">${escapeHtml(
                            exercise.detail
                          )}</div>`
                        : ''
                    }
                  </li>`
              )
              .join('')}
          </ol>
        </article>`
    )
    .join('');

  return `
    <div class="plan-overview-card">
      <div class="plan-summary-row">
        <span class="plan-meta-pill"><strong>Focus:</strong> ${escapeHtml(
          entry.plan.focus
        )}</span>
        <span class="plan-meta-pill"><strong>Duration:</strong> ${
          entry.plan.durationMinutes
        } min</span>
        <span class="plan-meta-pill"><strong>Energy:</strong> ${escapeHtml(
          entry.plan.energy
        )}</span>
      </div>
      <div class="plan-summary-row">
        <span class="plan-meta-pill"><strong>Equipment:</strong> ${equipment
          .map(escapeHtml)
          .join(', ')}</span>
      </div>
      <p class="plan-summary-text">${escapeHtml(entry.plan.summary)}</p>
      <div class="plan-block-grid">${blockCards}</div>
    </div>`;
}

function renderPlanDetailsMarkdown(
  entry: GenerationEvaluationReportEntry
): string[] {
  if (!entry.plan) {
    return ['No plan available for this run.'];
  }

  const lines = [
    `Summary: ${entry.plan.summary}`,
    `Focus: ${entry.plan.focus}`,
    `Duration: ${entry.plan.durationMinutes} min`,
    `Energy: ${entry.plan.energy}`,
    `Equipment: ${(entry.plan.equipment.length > 0
      ? entry.plan.equipment
      : ['Bodyweight']
    ).join(', ')}`,
    '',
  ];

  entry.plan.blocks.forEach((block, blockIndex) => {
    lines.push(
      `${blockIndex + 1}. ${block.title} (${block.durationMinutes} min, ${
        block.focus
      })`
    );
    block.exercises.forEach((exercise) => {
      lines.push(`- ${exercise.name}`);
      lines.push(`Prescription: ${exercise.prescription}`);
      if (exercise.detail) {
        lines.push(`Detail: ${exercise.detail}`);
      }
    });
    lines.push('');
  });

  return lines;
}

function toPercent(value: number, total: number): string {
  if (total === 0) {
    return '0%';
  }

  return `${Math.round((value / total) * 100)}%`;
}

function formatLatencyMs(value?: number): string {
  if (value === undefined) {
    return 'n/a';
  }

  return `${value.toFixed(0)} ms`;
}

function average(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildAverageLatency(
  entries: Pick<GenerationEvaluationReportEntry, 'latencyMs'>[]
): GenerationEvaluationAverageLatency {
  return {
    totalRequestMs:
      average(entries.map((entry) => entry.latencyMs.totalRequestMs)) ?? 0,
    stageOnePlannerMs: average(
      entries
        .map((entry) => entry.latencyMs.stageOnePlannerMs)
        .filter((value): value is number => value !== undefined)
    ),
    stageTwoGenerationMs: average(
      entries
        .map((entry) => entry.latencyMs.stageTwoGenerationMs)
        .filter((value): value is number => value !== undefined)
    ),
  };
}

function summarizeEntryHardChecks(entry: GenerationEvaluationReportEntry) {
  const pass = entry.hardChecks.filter((item) => item.status === 'pass').length;
  const fail = entry.hardChecks.filter((item) => item.status === 'fail').length;
  const skipped = entry.hardChecks.filter(
    (item) => item.status === 'not-applicable'
  ).length;

  return { pass, fail, skipped };
}

function buildDerivedStats(report: GenerationEvaluationReport) {
  const uniqueScenarios = new Set(
    report.entries.map((entry) => entry.scenarioId)
  ).size;
  const entriesWithHardFailures = report.entries.filter((entry) =>
    entry.hardChecks.some((check) => check.status === 'fail')
  );
  const cleanEntries = report.entries.filter(
    (entry) =>
      entry.status === 'success' &&
      !entry.hardChecks.some((check) => check.status === 'fail')
  );

  const providerStats = Array.from(
    report.entries
      .reduce((acc, entry) => {
        const current = acc.get(entry.provider) ?? {
          provider: entry.provider,
          total: 0,
          success: 0,
          hardFailEntries: 0,
        };
        current.total += 1;
        if (entry.status === 'success') {
          current.success += 1;
        }
        if (entry.hardChecks.some((check) => check.status === 'fail')) {
          current.hardFailEntries += 1;
        }
        acc.set(entry.provider, current);
        return acc;
      }, new Map<string, { provider: string; total: number; success: number; hardFailEntries: number }>())
      .values()
  );

  const modeStats = Array.from(
    report.entries
      .reduce((acc, entry) => {
        const current = acc.get(entry.scenarioMode) ?? {
          mode: entry.scenarioMode,
          total: 0,
          hardFailEntries: 0,
        };
        current.total += 1;
        if (entry.hardChecks.some((check) => check.status === 'fail')) {
          current.hardFailEntries += 1;
        }
        acc.set(entry.scenarioMode, current);
        return acc;
      }, new Map<string, { mode: string; total: number; hardFailEntries: number }>())
      .values()
  );

  const tagStats = Array.from(
    report.entries
      .reduce((acc, entry) => {
        const hasHardFailure = entry.hardChecks.some(
          (check) => check.status === 'fail'
        );
        entry.scenarioTags.forEach((tag) => {
          const current = acc.get(tag) ?? { tag, total: 0, hardFailEntries: 0 };
          current.total += 1;
          if (hasHardFailure) {
            current.hardFailEntries += 1;
          }
          acc.set(tag, current);
        });
        return acc;
      }, new Map<string, { tag: string; total: number; hardFailEntries: number }>())
      .values()
  )
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  const scenarioStats = Array.from(
    report.entries
      .reduce(
        (acc, entry) => {
          const current = acc.get(entry.scenarioId) ?? {
            scenarioId: entry.scenarioId,
            title: entry.scenarioTitle,
            providerSet: new Set<string>(),
            total: 0,
            hardFailEntries: 0,
            generationErrors: 0,
          };
          current.total += 1;
          current.providerSet.add(entry.provider);
          if (entry.hardChecks.some((check) => check.status === 'fail')) {
            current.hardFailEntries += 1;
          }
          if (entry.status !== 'success') {
            current.generationErrors += 1;
          }
          acc.set(entry.scenarioId, current);
          return acc;
        },
        new Map<
          string,
          {
            scenarioId: string;
            title: string;
            providerSet: Set<string>;
            total: number;
            hardFailEntries: number;
            generationErrors: number;
          }
        >()
      )
      .values()
  )
    .map((item) => ({
      ...item,
      providers: Array.from(item.providerSet).join(', '),
    }))
    .sort(
      (a, b) =>
        b.hardFailEntries - a.hardFailEntries ||
        b.generationErrors - a.generationErrors
    )
    .slice(0, 10);

  return {
    uniqueScenarios,
    cleanEntries,
    entriesWithHardFailures,
    fixtureOnly:
      report.summary.totalEntries > 0 &&
      report.summary.liveEntries === 0 &&
      report.summary.fixtureEntries === report.summary.totalEntries,
    providerStats,
    modeStats,
    tagStats,
    scenarioStats,
  };
}

function renderBar(
  label: string,
  value: number,
  total: number,
  tone = 'accent'
) {
  return `
    <div class="metric-row">
      <div class="metric-label"><span>${escapeHtml(
        label
      )}</span><strong>${value}</strong></div>
      <div class="metric-track"><div class="metric-fill ${tone}" style="width:${toPercent(
    value,
    total
  )}"></div></div>
      <div class="metric-meta">${toPercent(value, total)}</div>
    </div>
  `;
}

function renderHtmlReport(
  report: GenerationEvaluationReport,
  options: GenerationEvaluationRunOptions,
  warnings: string[]
): string {
  const derived = buildDerivedStats(report);
  const failureCounts = Object.entries(report.summary.hardFailureCounts)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([name, count]) =>
        `<li><strong>${escapeHtml(name)}</strong><span>${count}</span></li>`
    )
    .join('');

  const providerBars = derived.providerStats
    .map(
      (item) =>
        renderBar(
          `${item.provider} success`,
          item.success,
          item.total,
          'success'
        ) +
        renderBar(
          `${item.provider} hard-fail entries`,
          item.hardFailEntries,
          item.total,
          'danger'
        ) +
        `<p class="metric-meta">avg total ${escapeHtml(
          formatLatencyMs(
            report.summary.averageLatencyByProvider[item.provider]
              ?.totalRequestMs
          )
        )} · stage 1 ${escapeHtml(
          formatLatencyMs(
            report.summary.averageLatencyByProvider[item.provider]
              ?.stageOnePlannerMs
          )
        )} · stage 2 ${escapeHtml(
          formatLatencyMs(
            report.summary.averageLatencyByProvider[item.provider]
              ?.stageTwoGenerationMs
          )
        )}</p>`
    )
    .join('');

  const modeBars = derived.modeStats
    .map((item) =>
      renderBar(`${item.mode} entries`, item.total, report.summary.totalEntries)
    )
    .join('');

  const tagBars = derived.tagStats
    .map((item) =>
      renderBar(item.tag, item.hardFailEntries, item.total, 'warn')
    )
    .join('');

  const scenarioRows = derived.scenarioStats
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.title)}</td>
          <td>${escapeHtml(item.providers)}</td>
          <td>${item.total}</td>
          <td>${item.hardFailEntries}</td>
          <td>${item.generationErrors}</td>
        </tr>
      `
    )
    .join('');

  const filterProviderOptions = Array.from(
    new Set(report.entries.map((entry) => entry.provider))
  )
    .sort()
    .map(
      (provider) =>
        `<option value="${escapeHtml(provider)}">${escapeHtml(
          provider
        )}</option>`
    )
    .join('');

  const filterModeOptions = Array.from(
    new Set(report.entries.map((entry) => entry.scenarioMode))
  )
    .sort()
    .map(
      (mode) =>
        `<option value="${escapeHtml(mode)}">${escapeHtml(mode)}</option>`
    )
    .join('');

  const filterSourceOptions = Array.from(
    new Set(report.entries.map((entry) => entry.executionSource))
  )
    .sort()
    .map(
      (source) =>
        `<option value="${escapeHtml(source)}">${escapeHtml(source)}</option>`
    )
    .join('');

  const filterStatusOptions = Array.from(
    new Set(report.entries.map((entry) => entry.status))
  )
    .sort()
    .map(
      (status) =>
        `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`
    )
    .join('');

  const reportDataScript = JSON.stringify(report).replace(
    /<\/script/gi,
    '<\\/script'
  );

  const cards = report.entries
    .map((entry) => {
      const failedChecks = entry.hardChecks.filter(
        (item) => item.status === 'fail'
      );
      const checkSummary = summarizeEntryHardChecks(entry);
      const planDetails = renderPlanDetailsHtml(entry);
      const plannerDetails = entry.plannerSummary.usedStageOne
        ? `<p><strong>Stage one:</strong> used</p>${
            entry.plannerSummary.artifact
              ? `<pre>${escapeHtml(
                  JSON.stringify(entry.plannerSummary.artifact, null, 2)
                )}</pre>`
              : '<p class="muted">No stage-one artifact captured.</p>'
          }${
            entry.plannerSummary.stageOnePrompt
              ? `<p><strong>Planner Prompt:</strong> ${escapeHtml(
                  entry.plannerSummary.stageOnePrompt.provider
                )}${
                  entry.plannerSummary.stageOnePrompt.model
                    ? ` · <strong>Model:</strong> ${escapeHtml(
                        entry.plannerSummary.stageOnePrompt.model
                      )}`
                    : ''
                }</p><pre>${escapeHtml(
                  entry.plannerSummary.stageOnePrompt.content
                )}</pre>`
              : '<p class="muted">Stage-one prompt was not captured.</p>'
          }`
        : '<p class="muted">Stage one was not used for this run.</p>';
      const promptDetails = entry.providerPrompt
        ? `<p><strong>Provider:</strong> ${escapeHtml(
            entry.providerPrompt.provider
          )}${
            entry.providerPrompt.model
              ? ` · <strong>Model:</strong> ${escapeHtml(
                  entry.providerPrompt.model
                )}`
              : ''
          }${
            entry.providerPrompt.schemaVersion
              ? ` · <strong>Schema:</strong> ${escapeHtml(
                  entry.providerPrompt.schemaVersion
                )}`
              : ''
          }${
            entry.providerPrompt.isRegeneration
              ? ' · <strong>Regeneration</strong>'
              : ''
          }</p><pre>${escapeHtml(entry.providerPrompt.content)}</pre>`
        : '<p class="muted">Prompt was not captured for this run.</p>';
      const latencyDetails = `<p><strong>Total:</strong> ${escapeHtml(
        formatLatencyMs(entry.latencyMs.totalRequestMs)
      )}</p><p><strong>Stage 1:</strong> ${escapeHtml(
        formatLatencyMs(entry.latencyMs.stageOnePlannerMs)
      )}</p><p><strong>Stage 2:</strong> ${escapeHtml(
        formatLatencyMs(entry.latencyMs.stageTwoGenerationMs)
      )}</p>`;
      const filterText = [
        entry.scenarioTitle,
        entry.scenarioDescription,
        entry.provider,
        entry.executionSource,
        entry.scenarioTags.join(' '),
        entry.errorMessage ?? '',
        entry.plan?.summary ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return `
        <details
          class="entry-card ${escapeHtml(entry.status)}"
          data-provider="${escapeHtml(entry.provider)}"
          data-mode="${escapeHtml(entry.scenarioMode)}"
          data-status="${escapeHtml(entry.status)}"
          data-source="${escapeHtml(entry.executionSource)}"
          data-hard-fails="${failedChecks.length}"
          data-search="${escapeHtml(filterText)}"
        >
          <summary>
            <div>
              <h3>${escapeHtml(entry.scenarioTitle)}</h3>
              <p>${escapeHtml(entry.runId)} · ${escapeHtml(
        entry.provider
      )} · ${escapeHtml(entry.executionSource)}</p>
            </div>
            <div class="badges">
              <span class="badge status-${escapeHtml(
                entry.status
              )}">${escapeHtml(entry.status)}</span>
              <span class="badge source-${escapeHtml(
                entry.executionSource
              )}">${escapeHtml(entry.executionSource)}</span>
              <span class="badge badge-fail">${
                failedChecks.length
              } hard fails</span>
              <span class="badge badge-pass">${checkSummary.pass} pass</span>
              <span class="badge badge-skip">${checkSummary.skipped} n/a</span>
            </div>
          </summary>
          <div class="entry-grid">
            <section>
              <h4>Scenario</h4>
              <p>${escapeHtml(entry.scenarioDescription)}</p>
              <p><strong>Tags:</strong> ${entry.scenarioTags
                .map(escapeHtml)
                .join(', ')}</p>
              <pre>${escapeHtml(
                JSON.stringify(
                  { request: entry.request, context: entry.context },
                  null,
                  2
                )
              )}</pre>
            </section>
            <section>
              <h4>Plan Overview</h4>
              <p>${escapeHtml(buildPlanOverview(entry))}</p>
              ${planDetails}
            </section>
            <section>
              <h4>Hard Checks</h4>
              <ul class="checks">
                ${entry.hardChecks
                  .map(
                    (check) =>
                      `<li class="${escapeHtml(
                        check.status
                      )}"><strong>${escapeHtml(
                        check.name
                      )}</strong>: ${escapeHtml(check.status)}${
                        check.message ? ` - ${escapeHtml(check.message)}` : ''
                      }</li>`
                  )
                  .join('')}
              </ul>
            </section>
            <section>
              <h4>Latency</h4>
              ${latencyDetails}
            </section>
            <section>
              <h4>Planner Summary</h4>
              ${plannerDetails}
            </section>
            <section>
              <h4>Provider Prompt</h4>
              ${promptDetails}
            </section>
            <section>
              <h4>Baseline / Errors</h4>
              ${
                entry.baselinePlan
                  ? `<p><strong>Baseline:</strong> ${escapeHtml(
                      entry.baselinePlan.focus
                    )} - ${entry.baselinePlan.durationMinutes} min</p>`
                  : '<p class="muted">No baseline plan.</p>'
              }
              ${
                entry.errorMessage
                  ? `<p class="error-text"><strong>Error:</strong> ${escapeHtml(
                      entry.errorMessage
                    )}</p>`
                  : '<p class="muted">No error message.</p>'
              }
              <p><strong>Passed:</strong> ${
                entry.hardChecks
                  .filter((item) => item.status === 'pass')
                  .map((item) => escapeHtml(item.name))
                  .join(', ') || 'none'
              }</p>
            </section>
          </div>
        </details>
      `;
    })
    .join('');

  const warningHtml =
    warnings.length > 0
      ? `<section class="warnings"><h3>Warnings</h3><ul>${warnings
          .map((warning) => `<li>${escapeHtml(warning)}</li>`)
          .join('')}</ul></section>`
      : '';

  const coverageBanner = derived.fixtureOnly
    ? `<section class="warnings fixture-only-banner"><h3>Fixture-Only Run</h3><p>This report contains no live provider generations. It is useful for plumbing and rubric checks, but it does not tell you how OpenAI or Gemini are behaving yet.</p><div class="pill-row"><span class="badge badge-fail">live entries: 0</span><span class="badge badge-skip">fixture entries: ${report.summary.fixtureEntries}</span></div></section>`
    : report.summary.fixtureEntries > 0
    ? `<section class="warnings mixed-run-banner"><h3>Mixed Coverage</h3><p>This report blends live and fixture-backed entries. Use the execution-source filter to isolate live behavior before drawing quality conclusions.</p><div class="pill-row"><span class="badge source-live">live entries: ${report.summary.liveEntries}</span><span class="badge source-fixture">fixture entries: ${report.summary.fixtureEntries}</span></div></section>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Workout Generation Evaluation Report</title>
    <style>
      :root { color-scheme: light; --bg: #f5f7fb; --panel: #ffffff; --panel-alt: #f8fbff; --text: #132238; --muted: #5e718d; --border: #dbe4f0; --accent: #2c6bed; --accent-soft: #dbe7ff; --success: #198754; --success-soft: #def7e6; --warn: #b7791f; --warn-soft: #fff3d6; --danger: #c0392b; --danger-soft: #fde4df; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(180deg, #eef3ff 0%, var(--bg) 100%); color: var(--text); }
      .wrap { max-width: 1500px; margin: 0 auto; padding: 32px 20px 64px; }
      h1, h2, h3, h4 { margin: 0 0 12px; }
      p { margin: 0 0 10px; color: var(--muted); }
      .hero, .summary, .warnings, .entry-card, .controls, .insights, .scenario-table { background: var(--panel); border: 1px solid var(--border); border-radius: 18px; box-shadow: 0 12px 40px rgba(19, 34, 56, 0.06); }
      .hero, .summary, .warnings, .controls, .insights, .scenario-table { padding: 24px; margin-bottom: 20px; }
      .fixture-only-banner { border-color: var(--danger); background: linear-gradient(180deg, #fff7f5 0%, #fff 100%); }
      .mixed-run-banner { border-color: var(--warn); background: linear-gradient(180deg, #fffaf0 0%, #fff 100%); }
      .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
      .stat { padding: 16px; border: 1px solid var(--border); border-radius: 14px; background: #fafcff; }
      .stat strong { display: block; font-size: 28px; margin-bottom: 4px; }
      .pill-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .badge { display: inline-flex; align-items: center; padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid var(--border); background: #f6f8fc; }
      .badge-pass { background: var(--success-soft); }
      .badge-fail { background: var(--danger-soft); }
      .badge-skip { background: var(--warn-soft); }
      .status-success, .pass { color: var(--success); }
      .status-generation-error, .status-validation-error, .fail, .error-text { color: var(--danger); }
      .status-skipped, .not-applicable { color: var(--warn); }
      .source-live { color: var(--accent); }
      .source-fixture { color: var(--warn); }
      .entry-card { margin-bottom: 14px; overflow: hidden; }
      .entry-card[hidden] { display: none; }
      .entry-card summary { list-style: none; display: flex; justify-content: space-between; gap: 16px; padding: 20px; cursor: pointer; }
      .entry-card summary::-webkit-details-marker { display: none; }
      .entry-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; padding: 0 20px 20px; }
      .entry-grid section { border-top: 1px solid var(--border); padding-top: 16px; }
      pre { margin: 0; padding: 12px; overflow: auto; background: #0f172a; color: #d9e5ff; border-radius: 12px; font-size: 12px; }
      .checks, .warnings ul, .failure-list { margin: 0; padding-left: 18px; }
      .plan-overview-card { display: grid; gap: 12px; }
      .plan-summary-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .plan-meta-pill { display: inline-flex; gap: 6px; align-items: center; padding: 6px 10px; border-radius: 999px; background: var(--panel-alt); border: 1px solid var(--border); font-size: 12px; color: var(--text); }
      .plan-summary-text { margin: 0; color: var(--text); font-size: 14px; line-height: 1.5; }
      .plan-block-grid { display: grid; gap: 12px; }
      .plan-block { background: var(--panel-alt); border: 1px solid var(--border); border-radius: 14px; padding: 14px; }
      .plan-block-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
      .plan-block-header h5 { margin: 0 0 4px; font-size: 15px; }
      .plan-block-header p { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
      .plan-block-time { white-space: nowrap; padding: 4px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-weight: 700; font-size: 12px; }
      .plan-exercise-list { margin: 0; padding-left: 20px; display: grid; gap: 10px; }
      .plan-exercise-item { padding-left: 2px; }
      .plan-exercise-name { font-weight: 700; color: var(--text); margin-bottom: 2px; }
      .plan-exercise-prescription { color: var(--text); font-size: 13px; line-height: 1.45; }
      .plan-exercise-detail { color: var(--muted); font-size: 12px; line-height: 1.45; margin-top: 3px; }
      .failure-list li { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; }
      .muted { color: var(--muted); }
      .controls-grid, .insights-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
      .control label { display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px; }
      .control input, .control select { width: 100%; border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; font: inherit; background: var(--panel-alt); color: var(--text); }
      .toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-top: 18px; }
      .toolbar-buttons { display: flex; flex-wrap: wrap; gap: 10px; }
      button { border: 1px solid var(--border); background: var(--panel-alt); color: var(--text); border-radius: 999px; padding: 10px 14px; font: inherit; font-weight: 700; cursor: pointer; }
      button:hover { border-color: var(--accent); color: var(--accent); }
      .insight-card { padding: 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--panel-alt); }
      .metric-row { margin-bottom: 12px; }
      .metric-label { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; font-size: 14px; }
      .metric-track { height: 12px; background: #eaf0f7; border-radius: 999px; overflow: hidden; }
      .metric-fill { height: 100%; border-radius: 999px; }
      .metric-fill.accent { background: linear-gradient(90deg, #95b8ff, var(--accent)); }
      .metric-fill.success { background: linear-gradient(90deg, #88ddb0, var(--success)); }
      .metric-fill.warn { background: linear-gradient(90deg, #f7d48b, var(--warn)); }
      .metric-fill.danger { background: linear-gradient(90deg, #f2a49a, var(--danger)); }
      .metric-meta { margin-top: 4px; font-size: 12px; color: var(--muted); }
      .scenario-table table { width: 100%; border-collapse: collapse; }
      .scenario-table th, .scenario-table td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
      .scenario-table th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
      .results-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
      .results-count { font-weight: 700; color: var(--muted); }
      @media (max-width: 700px) { .entry-card summary { flex-direction: column; } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <section class="hero">
        <h1>Workout Generation Evaluation Report</h1>
        <p>Corpus ${escapeHtml(report.corpusVersion)} · Rubric ${escapeHtml(
    report.rubricVersion
  )} · Generated ${escapeHtml(report.generatedAt)}</p>
        <div class="pill-row">
          <span class="badge">providers: ${escapeHtml(
            options.providers.join(', ')
          )}</span>
          <span class="badge">runs per scenario: ${options.runs}</span>
          <span class="badge">edition: ${escapeHtml(options.edition)}</span>
          <span class="badge">entries: ${report.summary.totalEntries}</span>
          <span class="badge">unique scenarios: ${
            derived.uniqueScenarios
          }</span>
          <span class="badge">clean entries: ${
            derived.cleanEntries.length
          }</span>
          <span class="badge source-live">live: ${
            report.summary.liveEntries
          }</span>
          <span class="badge source-fixture">fixture: ${
            report.summary.fixtureEntries
          }</span>
        </div>
      </section>
      ${coverageBanner}
      ${warningHtml}
      <section class="summary">
        <h2>Summary</h2>
        <div class="summary-grid">
          <div class="stat"><strong>${
            report.summary.totalEntries
          }</strong><span>Total entries</span></div>
          <div class="stat"><strong>${
            report.summary.successfulEntries
          }</strong><span>Successful entries</span></div>
          <div class="stat"><strong>${
            report.summary.failedEntries
          }</strong><span>Failed entries</span></div>
          <div class="stat"><strong>${
            Object.keys(report.summary.hardFailureCounts).length
          }</strong><span>Distinct hard-failure types</span></div>
          <div class="stat"><strong>${toPercent(
            derived.cleanEntries.length,
            report.summary.totalEntries
          )}</strong><span>Clean entry rate</span></div>
          <div class="stat"><strong>${toPercent(
            derived.entriesWithHardFailures.length,
            report.summary.totalEntries
          )}</strong><span>Entries with hard failures</span></div>
          <div class="stat"><strong>${
            report.summary.liveEntries
          }</strong><span>Live entries</span></div>
          <div class="stat"><strong>${
            report.summary.fixtureEntries
          }</strong><span>Fixture-backed entries</span></div>
          <div class="stat"><strong>${formatLatencyMs(
            report.summary.averageLatencyMs.totalRequestMs
          )}</strong><span>Avg total latency</span></div>
          <div class="stat"><strong>${formatLatencyMs(
            report.summary.averageLatencyMs.stageOnePlannerMs
          )}</strong><span>Avg stage 1 latency</span></div>
          <div class="stat"><strong>${formatLatencyMs(
            report.summary.averageLatencyMs.stageTwoGenerationMs
          )}</strong><span>Avg stage 2 latency</span></div>
        </div>
        <h3 style="margin-top: 20px;">Top hard failures</h3>
        <ul class="failure-list">${
          failureCounts || '<li><strong>none</strong><span>0</span></li>'
        }</ul>
      </section>
      <section class="controls">
        <div class="results-header">
          <h2>Review Controls</h2>
          <div class="results-count" id="results-count">Showing ${
            report.entries.length
          } of ${report.entries.length} entries</div>
        </div>
        <div class="controls-grid">
          <div class="control"><label for="search">Search</label><input id="search" type="search" placeholder="Search title, tags, provider, summary" /></div>
          <div class="control"><label for="provider-filter">Provider</label><select id="provider-filter"><option value="">All providers</option>${filterProviderOptions}</select></div>
          <div class="control"><label for="mode-filter">Mode</label><select id="mode-filter"><option value="">All modes</option>${filterModeOptions}</select></div>
          <div class="control"><label for="status-filter">Status</label><select id="status-filter"><option value="">All statuses</option>${filterStatusOptions}</select></div>
          <div class="control"><label for="source-filter">Execution source</label><select id="source-filter"><option value="">All execution sources</option>${filterSourceOptions}</select></div>
          <div class="control"><label for="hard-fail-toggle">Quick toggle</label><select id="hard-fail-toggle"><option value="">All entries</option><option value="hard-fails">Only entries with hard failures</option><option value="clean">Only clean entries</option></select></div>
        </div>
        <div class="toolbar">
          <div class="toolbar-buttons">
            <button type="button" id="expand-failed">Expand failed entries</button>
            <button type="button" id="collapse-all">Collapse all</button>
            <button type="button" id="reset-filters">Reset filters</button>
          </div>
          <div class="pill-row">
            <span class="badge">Search is client-side</span>
            <span class="badge">JSON is ideal for AI ingestion</span>
          </div>
        </div>
      </section>
      <section class="insights">
        <h2>Breakdowns</h2>
        <div class="insights-grid">
          <div class="insight-card">
            <h3>By Provider</h3>
            ${
              providerBars || '<p class="muted">No provider data available.</p>'
            }
          </div>
          <div class="insight-card">
            <h3>By Mode</h3>
            ${modeBars || '<p class="muted">No mode data available.</p>'}
          </div>
          <div class="insight-card">
            <h3>Top Tags by Hard-Failure Rate</h3>
            ${tagBars || '<p class="muted">No tag failures yet.</p>'}
          </div>
        </div>
      </section>
      <section class="scenario-table">
        <h2>Most Problematic Scenarios</h2>
        <table>
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Providers</th>
              <th>Runs</th>
              <th>Hard-fail entries</th>
              <th>Generation errors</th>
            </tr>
          </thead>
          <tbody>
            ${
              scenarioRows ||
              '<tr><td colspan="5">No scenario issues yet.</td></tr>'
            }
          </tbody>
        </table>
      </section>
      <div id="entries-root">
      ${cards}
      </div>
    </div>
    <script id="report-data" type="application/json">${reportDataScript}</script>
    <script>
      const entries = Array.from(document.querySelectorAll('.entry-card'));
      const searchInput = document.getElementById('search');
      const providerFilter = document.getElementById('provider-filter');
      const modeFilter = document.getElementById('mode-filter');
      const statusFilter = document.getElementById('status-filter');
      const sourceFilter = document.getElementById('source-filter');
      const hardFailToggle = document.getElementById('hard-fail-toggle');
      const resultsCount = document.getElementById('results-count');

      function applyFilters() {
        const search = searchInput.value.trim().toLowerCase();
        const provider = providerFilter.value;
        const mode = modeFilter.value;
        const status = statusFilter.value;
        const source = sourceFilter.value;
        const hardToggle = hardFailToggle.value;

        let visible = 0;
        entries.forEach((entry) => {
          const matchesSearch = !search || entry.dataset.search.includes(search);
          const matchesProvider = !provider || entry.dataset.provider === provider;
          const matchesMode = !mode || entry.dataset.mode === mode;
          const matchesStatus = !status || entry.dataset.status === status;
          const matchesSource = !source || entry.dataset.source === source;
          const hardFails = Number(entry.dataset.hardFails || '0');
          const matchesHardToggle = !hardToggle || (hardToggle === 'hard-fails' ? hardFails > 0 : hardFails === 0);

          const visibleNow = matchesSearch && matchesProvider && matchesMode && matchesStatus && matchesSource && matchesHardToggle;
          entry.hidden = !visibleNow;
          if (visibleNow) visible += 1;
        });

        resultsCount.textContent = 'Showing ' + visible + ' of ' + entries.length + ' entries';
      }

      [searchInput, providerFilter, modeFilter, statusFilter, sourceFilter, hardFailToggle].forEach((element) => {
        element.addEventListener('input', applyFilters);
        element.addEventListener('change', applyFilters);
      });

      document.getElementById('reset-filters').addEventListener('click', () => {
        searchInput.value = '';
        providerFilter.value = '';
        modeFilter.value = '';
        statusFilter.value = '';
        sourceFilter.value = '';
        hardFailToggle.value = '';
        applyFilters();
      });

      document.getElementById('collapse-all').addEventListener('click', () => {
        entries.forEach((entry) => { entry.open = false; });
      });

      document.getElementById('expand-failed').addEventListener('click', () => {
        entries.forEach((entry) => {
          entry.open = !entry.hidden && Number(entry.dataset.hardFails || '0') > 0;
        });
      });
    </script>
  </body>
</html>`;
}

function renderMarkdownReport(
  report: GenerationEvaluationReport,
  options: GenerationEvaluationRunOptions,
  warnings: string[]
): string {
  const lines: string[] = [
    '# Workout Generation Evaluation Report',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Corpus: ${report.corpusVersion}`,
    `- Rubric: ${report.rubricVersion}`,
    `- Providers: ${options.providers.join(', ')}`,
    `- Runs per scenario: ${options.runs}`,
    `- Edition: ${options.edition}`,
    '',
    '## Summary',
    '',
    `- Total entries: ${report.summary.totalEntries}`,
    `- Successful entries: ${report.summary.successfulEntries}`,
    `- Failed entries: ${report.summary.failedEntries}`,
    `- Live entries: ${report.summary.liveEntries}`,
    `- Fixture-backed entries: ${report.summary.fixtureEntries}`,
    `- Avg total latency: ${formatLatencyMs(
      report.summary.averageLatencyMs.totalRequestMs
    )}`,
    `- Avg stage 1 latency: ${formatLatencyMs(
      report.summary.averageLatencyMs.stageOnePlannerMs
    )}`,
    `- Avg stage 2 latency: ${formatLatencyMs(
      report.summary.averageLatencyMs.stageTwoGenerationMs
    )}`,
    '',
  ];

  if (report.summary.liveEntries === 0 && report.summary.fixtureEntries > 0) {
    lines.push(
      '> This report is fixture-only. Use it for plumbing and rubric checks, not model-quality judgments.',
      ''
    );
  }

  if (warnings.length > 0) {
    lines.push('## Warnings', '');
    warnings.forEach((warning) => lines.push(`- ${warning}`));
    lines.push('');
  }

  lines.push('## Hard Failure Counts', '');
  Object.entries(report.summary.hardFailureCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => lines.push(`- ${name}: ${count}`));
  lines.push('', '## Entries', '');

  report.entries.forEach((entry) => {
    const failedChecks = entry.hardChecks.filter(
      (item) => item.status === 'fail'
    );
    lines.push(`### ${entry.scenarioTitle} (${entry.runId})`, '');
    lines.push(`- Provider: ${entry.provider} (${entry.executionSource})`);
    lines.push(`- Status: ${entry.status}`);
    lines.push(`- Tags: ${entry.scenarioTags.join(', ')}`);
    lines.push(`- Plan: ${buildPlanOverview(entry)}`);
    lines.push(
      `- Hard failures: ${
        failedChecks.length > 0
          ? failedChecks.map((item) => item.name).join(', ')
          : 'none'
      }`
    );
    lines.push(
      `- Stage one used: ${entry.plannerSummary.usedStageOne ? 'yes' : 'no'}`
    );
    lines.push(
      `- Total latency: ${formatLatencyMs(entry.latencyMs.totalRequestMs)}`
    );
    lines.push(
      `- Stage 1 latency: ${formatLatencyMs(entry.latencyMs.stageOnePlannerMs)}`
    );
    lines.push(
      `- Stage 2 latency: ${formatLatencyMs(
        entry.latencyMs.stageTwoGenerationMs
      )}`
    );
    lines.push(`- Prompt captured: ${entry.providerPrompt ? 'yes' : 'no'}`);
    if (entry.errorMessage) {
      lines.push(`- Error: ${entry.errorMessage}`);
    }
    lines.push('', '#### Plan Details', '');
    lines.push(...renderPlanDetailsMarkdown(entry));
    if (entry.plannerSummary.artifact) {
      lines.push(
        '',
        '#### Planner Artifact',
        '',
        '```json',
        JSON.stringify(entry.plannerSummary.artifact, null, 2),
        '```',
        ''
      );
    }
    if (entry.plannerSummary.stageOnePrompt) {
      lines.push(
        '',
        '#### Stage-One Prompt',
        '',
        '```text',
        entry.plannerSummary.stageOnePrompt.content,
        '```',
        ''
      );
    }
    if (entry.providerPrompt) {
      lines.push(
        '',
        '#### Provider Prompt',
        '',
        '```text',
        entry.providerPrompt.content,
        '```',
        ''
      );
    }
    lines.push('', '```json', JSON.stringify(entry, null, 2), '```', '');
  });

  return lines.join('\n');
}

async function writeArtifacts(
  report: GenerationEvaluationReport,
  options: GenerationEvaluationRunOptions,
  warnings: string[]
): Promise<GenerationEvaluationArtifacts> {
  await mkdir(options.outputDir, { recursive: true });

  const html = path.join(options.outputDir, 'report.html');
  const json = path.join(options.outputDir, 'report.json');
  const jsonl = path.join(options.outputDir, 'report.jsonl');
  const markdown = path.join(options.outputDir, 'report.md');
  const summary = path.join(options.outputDir, 'summary.json');

  const jsonlBody = report.entries
    .map((entry) => JSON.stringify(entry))
    .join('\n');

  await Promise.all([
    writeFile(html, renderHtmlReport(report, options, warnings), 'utf8'),
    writeFile(json, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(jsonl, `${jsonlBody}\n`, 'utf8'),
    writeFile(
      markdown,
      renderMarkdownReport(report, options, warnings),
      'utf8'
    ),
    writeFile(
      summary,
      `${JSON.stringify(
        {
          warnings,
          artifacts: { html, json, jsonl, markdown },
          summary: report.summary,
        },
        null,
        2
      )}\n`,
      'utf8'
    ),
  ]);

  return { html, json, jsonl, markdown, summary };
}

export async function runGenerationEvaluation(
  options: GenerationEvaluationRunOptions
): Promise<GenerationEvaluationRunResult> {
  const scenarios = selectScenarios(options);
  const warnings: string[] = [];
  const entries: GenerationEvaluationReportEntry[] = [];
  const handlerBundles = new Map<GenerationEvaluationProvider, HandlerBundle>();

  options.providers.forEach((provider) => {
    const bundle = createHandlerBundle(provider, options.edition);
    handlerBundles.set(provider, bundle);

    if (
      provider !== 'fixture' &&
      !bundle.hasConfiguredAccess &&
      options.edition === 'CE'
    ) {
      warnings.push(
        `${provider} has no configured key or Vertex access in CE. These runs are expected to fail with provider configuration errors unless credentials are provided.`
      );
    }
    if (
      provider !== 'fixture' &&
      !bundle.hasConfiguredAccess &&
      options.edition === 'HOSTED'
    ) {
      warnings.push(
        `${provider} has no configured key or Vertex access in HOSTED mode. These runs are expected to fail with BYOK requirements.`
      );
    }
  });

  const liveProviders = options.providers.filter(
    (provider) => provider !== 'fixture'
  );
  const primingAttemptCount =
    scenarios.filter((scenario) => scenario.mode === 'regeneration').length *
    options.runs *
    liveProviders.length;
  const liveEntryCount =
    scenarios.length * options.runs * liveProviders.length +
    primingAttemptCount;
  if (liveEntryCount >= 100) {
    pushUniqueWarning(
      warnings,
      `This run is configured for ${liveEntryCount} live-provider attempts. Review provider cost and quota implications before sharing results.`
    );
  }

  for (const scenario of scenarios) {
    for (const provider of options.providers) {
      const bundle = handlerBundles.get(provider);
      if (!bundle) {
        continue;
      }

      for (let runIndex = 1; runIndex <= options.runs; runIndex += 1) {
        const runId = `${scenario.id}-${provider}-${runIndex}`;
        let effectiveBaselinePlan = scenario.baselinePlan;
        let requestBody = buildRequestBody(scenario);

        if (scenario.mode === 'regeneration' && provider !== 'fixture') {
          if (!bundle.hasConfiguredAccess && options.edition === 'CE') {
            pushUniqueWarning(
              warnings,
              `Could not prime live regeneration for ${scenario.id} (${provider}); configured access is unavailable.`
            );
          } else {
            const primingResult = await executeScenarioRequest({
              bundle,
              provider,
              edition: options.edition,
              token: `${runId}-prime`,
              body: buildPrimingRequest(scenario),
            });

            if (
              primingResult.responseStatus === 200 &&
              primingResult.executionSource === 'live'
            ) {
              const primedPlan =
                primingResult.payload as GenerationEvaluationReportEntry['plan'];
              const primedResponseId = primedPlan?.responseId;

              if (primedResponseId) {
                effectiveBaselinePlan = primedPlan;
                requestBody = {
                  ...(scenario.context
                    ? { ...scenario.request, context: scenario.context }
                    : scenario.request),
                  previousResponseId: primedResponseId,
                };
              } else {
                pushUniqueWarning(
                  warnings,
                  `Could not prime live regeneration for ${scenario.id} (${provider}); the baseline response had no responseId.`
                );
              }
            } else {
              pushUniqueWarning(
                warnings,
                `Could not prime live regeneration for ${scenario.id} (${provider}); baseline generation was not live.`
              );
            }
          }
        }

        const executed = await executeScenarioRequest({
          bundle,
          provider,
          edition: options.edition,
          token: runId,
          body: requestBody,
        });

        if (executed.responseStatus === 200) {
          const plan =
            executed.payload as GenerationEvaluationReportEntry['plan'];
          entries.push({
            scenarioId: scenario.id,
            scenarioTitle: scenario.title,
            scenarioDescription: scenario.description,
            scenarioTags: scenario.tags,
            scenarioMode: scenario.mode,
            runId,
            provider,
            executionSource: executed.executionSource,
            status: 'success',
            request: scenario.request,
            context: scenario.context,
            baselinePlan: effectiveBaselinePlan,
            latencyMs: executed.latencyMs,
            plannerSummary: executed.plannerSummary,
            providerPrompt: executed.providerPrompt,
            hardChecks: runHardChecksForScenario(
              {
                ...scenario,
                baselinePlan: effectiveBaselinePlan,
              },
              plan
            ),
            plan,
          });
        } else {
          const errorPayload = parseErrorPayload(executed.payload);
          entries.push({
            scenarioId: scenario.id,
            scenarioTitle: scenario.title,
            scenarioDescription: scenario.description,
            scenarioTags: scenario.tags,
            scenarioMode: scenario.mode,
            runId,
            provider,
            executionSource: executed.executionSource,
            status: 'generation-error',
            request: scenario.request,
            context: scenario.context,
            baselinePlan: effectiveBaselinePlan,
            latencyMs: executed.latencyMs,
            plannerSummary: executed.plannerSummary,
            providerPrompt: executed.providerPrompt,
            hardChecks: runHardChecksForScenario({
              ...scenario,
              baselinePlan: effectiveBaselinePlan,
            }),
            errorCode: errorPayload.code,
            errorMessage:
              errorPayload.message ?? `HTTP ${executed.responseStatus}`,
          });
        }
      }
    }
  }

  const successfulEntries = entries.filter(
    (entry) => entry.status === 'success'
  ).length;
  const liveEntries = entries.filter(
    (entry) => entry.executionSource === 'live'
  ).length;
  const fixtureEntries = entries.length - liveEntries;
  const executionSourceCounts = entries.reduce<Record<string, number>>(
    (acc, entry) => {
      acc[entry.executionSource] = (acc[entry.executionSource] ?? 0) + 1;
      return acc;
    },
    {}
  );
  const hardFailureCounts = entries.reduce<Record<string, number>>(
    (acc, entry) => {
      const entryFailures = summarizeHardFailures(entry.hardChecks);
      for (const [name, count] of Object.entries(entryFailures)) {
        acc[name] = (acc[name] ?? 0) + count;
      }
      return acc;
    },
    {}
  );
  const averageLatencyMs = buildAverageLatency(entries);
  const entriesByProvider = entries.reduce<
    Record<string, GenerationEvaluationReportEntry[]>
  >((acc, entry) => {
    (acc[entry.provider] ??= []).push(entry);
    return acc;
  }, {});
  const averageLatencyByProvider = Object.fromEntries(
    Object.entries(entriesByProvider).map(([provider, providerEntries]) => [
      provider,
      buildAverageLatency(providerEntries),
    ])
  ) as Record<string, GenerationEvaluationAverageLatency>;

  const report = generationEvaluationReportSchema.parse({
    corpusVersion: workoutGenerationEvaluationCorpus.version,
    rubricVersion: workoutGenerationEvaluationCorpus.rubricVersion,
    generatedAt: new Date().toISOString(),
    summary: {
      totalEntries: entries.length,
      successfulEntries,
      failedEntries: entries.length - successfulEntries,
      liveEntries,
      fixtureEntries,
      executionSourceCounts,
      hardFailureCounts,
      averageLatencyMs,
      averageLatencyByProvider,
    },
    entries,
  });

  const artifacts = await writeArtifacts(report, options, warnings);
  return { report, warnings, artifacts };
}
