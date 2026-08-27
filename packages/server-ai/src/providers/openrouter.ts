import type { OpenRouter as OpenRouterClient } from '@openrouter/sdk';
import * as z from 'zod';
import {
  todayPlanSchema,
  type GenerationRequest,
  type GenerationContext,
} from '@leveza/shared';
import {
  createLogger,
  type StageOnePlannerArtifact,
} from '@leveza/server-core';
import type { AiProvider, AiProviderOptions, GenerationResult } from './types';
import { AiGenerationError } from './types';
import {
  SYSTEM_PROMPT,
  STAGE_ONE_PLANNER_SYSTEM_PROMPT,
  buildInitialGenerationPromptPayload,
  buildStageOnePlannerRequestPayload,
  buildRegenerationMessage,
} from './prompts';
import {
  transformLlmResponse,
  getDefaultSchemaVersion,
  getSchemaForVersion,
} from '../llm-transformer';
import {
  parseStageOnePlannerArtifact,
  stageOnePlannerArtifactSchema,
} from './stage-one-schema';
import { openRouterTokenUsage, recordModelCall } from './usage';

const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v4-flash-0731';
const DEFAULT_PLANNER_MODEL =
  process.env.OPENROUTER_PLANNER_MODEL ?? 'deepseek/deepseek-v4-flash-0731';
const DEFAULT_API_BASE =
  process.env.OPENROUTER_API_BASE ?? 'https://openrouter.ai/api/v1';
const configuredRequestTimeoutMs = Number.parseInt(
  process.env.OPENROUTER_TIMEOUT_MS ?? '',
  10
);
const DEFAULT_REQUEST_TIMEOUT_MS =
  Number.isFinite(configuredRequestTimeoutMs) && configuredRequestTimeoutMs > 0
    ? configuredRequestTimeoutMs
    : 60_000;

type OpenRouterChatClient = Pick<OpenRouterClient, 'chat'>;

async function getClient(
  options: AiProviderOptions
): Promise<OpenRouterChatClient> {
  if (options.client) {
    return options.client as OpenRouterChatClient;
  }
  if (!options.apiKey) {
    throw new AiGenerationError('Missing API key', 'NO_API_KEY');
  }

  const { OpenRouter } = await import('@openrouter/sdk');
  return new OpenRouter({
    apiKey: options.apiKey,
    serverURL: options.apiBaseUrl ?? DEFAULT_API_BASE,
    appTitle: 'Leveza',
    timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
  });
}

function getStatus(error: unknown): number | undefined {
  const candidate = error as { status?: unknown; statusCode?: unknown };
  if (typeof candidate.status === 'number') {
    return candidate.status;
  }
  return typeof candidate.statusCode === 'number'
    ? candidate.statusCode
    : undefined;
}

function getTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((item) => {
      if (
        item &&
        typeof item === 'object' &&
        'text' in item &&
        typeof item.text === 'string'
      ) {
        return item.text;
      }
      return '';
    })
    .join('')
    .trim();
}

export class OpenRouterProvider implements AiProvider {
  private readonly log = createLogger({ route: 'ai.openrouter' });

  async planStageOne(
    request: GenerationRequest,
    _context: GenerationContext,
    options: AiProviderOptions
  ): Promise<StageOnePlannerArtifact> {
    const client = await getClient(options);
    const model = options.model ?? DEFAULT_PLANNER_MODEL;
    const messages = [
      {
        role: 'system' as const,
        content: STAGE_ONE_PLANNER_SYSTEM_PROMPT,
      },
      {
        role: 'user' as const,
        content: JSON.stringify(
          buildStageOnePlannerRequestPayload(
            request,
            options.planningBrief,
            options.candidatePool
          )
        ),
      },
    ];

    options.promptRecorder?.({
      provider: 'openrouter',
      model,
      isRegeneration: Boolean(
        request.previousResponseId || request.baselineWorkout
      ),
      phase: 'stage-one-planner',
      content: JSON.stringify({ messages }, null, 2),
    });

    const started = Date.now();
    let callRecorded = false;
    try {
      const response = await client.chat.send({
        chatRequest: {
          model,
          messages,
          reasoningEffort: 'none',
          responseFormat: {
            type: 'json_schema',
            jsonSchema: {
              name: 'stage_one_planner',
              strict: true,
              schema: z.toJSONSchema(stageOnePlannerArtifactSchema),
            },
          },
          provider: { requireParameters: true },
          stream: false,
        },
      });
      if (!('choices' in response)) {
        throw new Error('Unexpected streaming response from OpenRouter');
      }
      recordModelCall(options, {
        provider: 'openrouter',
        phase: 'stage-one-planner',
        requestedModel: model,
        resolvedModel: response.model,
        responseId: response.id,
        startedAtMs: started,
        status: 'success',
        tokens: openRouterTokenUsage(response.usage),
        providerReportedCostUsd: response.usage?.cost ?? undefined,
      });
      callRecorded = true;
      const text = getTextContent(response.choices[0]?.message.content);
      if (!text) {
        throw new Error('Empty response from OpenRouter');
      }

      const artifact = parseStageOnePlannerArtifact(JSON.parse(text));
      this.log.info('stage-one planner completed', {
        provider: 'openrouter',
        model,
        durationMs: Date.now() - started,
      });
      return artifact;
    } catch (error) {
      const originalMessage =
        error instanceof Error ? error.message : String(error);
      const status = getStatus(error);
      if (!callRecorded) {
        recordModelCall(options, {
          provider: 'openrouter',
          phase: 'stage-one-planner',
          requestedModel: model,
          startedAtMs: started,
          status: 'error',
          errorCode: status ? String(status) : 'REQUEST_FAILED',
        });
      }
      throw new AiGenerationError(
        `Provider request failed${
          status ? ` (${status})` : ''
        }: ${originalMessage}`,
        'REQUEST_FAILED',
        status
      );
    }
  }

  async generate(
    request: GenerationRequest,
    context: GenerationContext,
    options: AiProviderOptions
  ): Promise<GenerationResult> {
    const client = await getClient(options);
    const model = options.model ?? DEFAULT_MODEL;
    const isRegeneration = Boolean(
      request.previousResponseId || request.baselineWorkout
    );
    const schemaVersion = getDefaultSchemaVersion({
      supportedSchemas: ['v1-current', 'v2-flat'],
    });
    const selectedSchema = getSchemaForVersion(schemaVersion);
    const prompt = isRegeneration
      ? buildRegenerationMessage(
          request,
          request.feedback,
          options.candidatePool,
          options.planningBrief,
          options.stageOneArtifact,
          options.catalogSeed
        )
      : JSON.stringify(
          buildInitialGenerationPromptPayload(
            request,
            context,
            options.planningBrief,
            options.candidatePool,
            options.stageOneArtifact,
            options.catalogSeed
          )
        );
    const messages = [
      ...(!isRegeneration
        ? [{ role: 'system' as const, content: SYSTEM_PROMPT }]
        : []),
      { role: 'user' as const, content: prompt },
    ];

    options.promptRecorder?.({
      provider: 'openrouter',
      model,
      schemaVersion,
      isRegeneration,
      phase: 'stage-two-generation',
      content: JSON.stringify({ messages }, null, 2),
    });

    let planPayload: unknown;
    let responseId = '';
    const started = Date.now();
    let callRecorded = false;
    try {
      const response = await client.chat.send({
        chatRequest: {
          model,
          messages,
          reasoningEffort: 'none',
          responseFormat: {
            type: 'json_schema',
            jsonSchema: {
              name: 'today_plan',
              strict: true,
              schema: z.toJSONSchema(selectedSchema),
            },
          },
          provider: { requireParameters: true },
          stream: false,
        },
      });
      if (!('choices' in response)) {
        throw new Error('Unexpected streaming response from OpenRouter');
      }
      recordModelCall(options, {
        provider: 'openrouter',
        phase: 'stage-two-generation',
        requestedModel: model,
        resolvedModel: response.model,
        responseId: response.id,
        startedAtMs: started,
        status: 'success',
        tokens: openRouterTokenUsage(response.usage),
        providerReportedCostUsd: response.usage?.cost ?? undefined,
      });
      callRecorded = true;
      const text = getTextContent(response.choices[0]?.message.content);
      if (!text) {
        throw new Error('Empty response from OpenRouter');
      }

      planPayload = selectedSchema.parse(JSON.parse(text));
      responseId = response.id;
      this.log.info('model call completed', {
        provider: 'openrouter',
        model,
        durationMs: Date.now() - started,
        isRegeneration,
      });
    } catch (error) {
      const originalMessage =
        error instanceof Error ? error.message : String(error);
      const status = getStatus(error);
      if (!callRecorded) {
        recordModelCall(options, {
          provider: 'openrouter',
          phase: 'stage-two-generation',
          requestedModel: model,
          startedAtMs: started,
          status: 'error',
          errorCode: status ? String(status) : 'REQUEST_FAILED',
        });
      }
      throw new AiGenerationError(
        `Provider request failed${
          status ? ` (${status})` : ''
        }: ${originalMessage}`,
        'REQUEST_FAILED',
        status
      );
    }

    const transformResult = transformLlmResponse(planPayload, {
      schemaVersion,
    });
    if (!transformResult.success) {
      this.log.error('transformation failed', {
        provider: 'openrouter',
        message: transformResult.error.message,
        schemaVersion: transformResult.schemaVersion,
      });
      throw new AiGenerationError(
        `LLM response transformation failed: ${transformResult.error.message}`,
        'INVALID_RESPONSE'
      );
    }

    const plan = {
      ...transformResult.plan,
      source: 'ai' as const,
      responseId,
    };
    this.log.info('transformation succeeded', {
      provider: 'openrouter',
      schemaVersion: transformResult.schemaVersion,
    });

    return {
      plan: todayPlanSchema.parse(plan),
      responseId,
      schemaVersion: transformResult.schemaVersion,
    };
  }
}
