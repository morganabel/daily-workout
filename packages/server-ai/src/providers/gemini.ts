import { GoogleGenAI, GoogleGenAIOptions } from '@google/genai';
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
import { geminiTokenUsage, recordModelCall } from './usage';

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash';
const DEFAULT_PLANNER_MODEL =
  process.env.GEMINI_PLANNER_MODEL ?? 'gemini-3.1-flash-lite';
const DEFAULT_API_BASE = process.env.GEMINI_API_BASE;
const getVertexEnvConfig = () => ({
  enabled: process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true',
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION,
});

export class GeminiProvider implements AiProvider {
  private readonly log = createLogger({ route: 'ai.gemini' });

  async planStageOne(
    request: GenerationRequest,
    _context: GenerationContext,
    options: AiProviderOptions
  ): Promise<StageOnePlannerArtifact> {
    const { log } = this;
    const vertexEnv = getVertexEnvConfig();
    const useVertex =
      options.useVertexAi ??
      Boolean(
        !options.apiKey &&
          vertexEnv.enabled &&
          vertexEnv.projectId &&
          vertexEnv.location
      );

    const clientConfig: GoogleGenAIOptions = {};

    if (useVertex) {
      clientConfig.vertexai = true;
      clientConfig.project = vertexEnv.projectId;
      clientConfig.location = vertexEnv.location;
    } else {
      if (!options.apiKey) {
        throw new AiGenerationError('Missing API key', 'NO_API_KEY');
      }
      clientConfig.apiKey = options.apiKey;
      const baseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE;
      if (baseUrl) {
        clientConfig.httpOptions = {
          ...(clientConfig.httpOptions ?? {}),
          baseUrl,
        };
      }
    }

    const genAI = new GoogleGenAI(clientConfig);
    const model = options.model ?? DEFAULT_PLANNER_MODEL;
    const prompt = `${STAGE_ONE_PLANNER_SYSTEM_PROMPT}\n\n${JSON.stringify(
      buildStageOnePlannerRequestPayload(
        request,
        options.planningBrief,
        options.candidatePool
      )
    )}`;

    options.promptRecorder?.({
      provider: 'gemini',
      model,
      isRegeneration: Boolean(
        request.previousResponseId || request.baselineWorkout
      ),
      phase: 'stage-one-planner',
      content: prompt,
    });

    const started = Date.now();
    let callRecorded = false;
    try {
      const result = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: z.toJSONSchema(stageOnePlannerArtifactSchema),
        },
      });
      recordModelCall(options, {
        provider: 'gemini',
        phase: 'stage-one-planner',
        requestedModel: model,
        resolvedModel: result.modelVersion,
        responseId: result.responseId,
        startedAtMs: started,
        status: 'success',
        tokens: geminiTokenUsage(result.usageMetadata),
        endpoint: useVertex ? 'vertex' : 'standard',
      });
      callRecorded = true;
      const text = (result.text ?? '').trim();
      if (!text) {
        throw new Error('Empty response from Gemini');
      }

      const parsed = JSON.parse(text);
      const artifact = parseStageOnePlannerArtifact(parsed);

      log.info('stage-one planner completed', {
        provider: 'gemini',
        model,
        useVertexAi: useVertex,
      });

      return artifact;
    } catch (error) {
      const originalMessage =
        error instanceof Error ? error.message : String(error);
      const status =
        typeof (error as { status?: number }).status === 'number'
          ? (error as { status?: number }).status
          : undefined;
      if (!callRecorded) {
        recordModelCall(options, {
          provider: 'gemini',
          phase: 'stage-one-planner',
          requestedModel: model,
          startedAtMs: started,
          status: 'error',
          endpoint: useVertex ? 'vertex' : 'standard',
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
    const { log } = this;
    const vertexEnv = getVertexEnvConfig();
    const useVertex =
      options.useVertexAi ??
      Boolean(
        !options.apiKey &&
          vertexEnv.enabled &&
          vertexEnv.projectId &&
          vertexEnv.location
      );

    const clientConfig: GoogleGenAIOptions = {};

    if (useVertex) {
      clientConfig.vertexai = true;
      clientConfig.project = vertexEnv.projectId;
      clientConfig.location = vertexEnv.location;
    } else {
      if (!options.apiKey) {
        throw new AiGenerationError('Missing API key', 'NO_API_KEY');
      }
      clientConfig.apiKey = options.apiKey;
      const baseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE;
      if (baseUrl) {
        clientConfig.httpOptions = {
          ...(clientConfig.httpOptions ?? {}),
          baseUrl,
        };
      }
    }

    const genAI = new GoogleGenAI(clientConfig);
    const model = options.model ?? DEFAULT_MODEL;

    const isRegeneration = Boolean(
      request.previousResponseId || request.baselineWorkout
    );

    // Select schema version using selection algorithm
    // Gemini supports both v1-current and v2-flat, but prefers v2-flat for lower depth
    const schemaVersion = getDefaultSchemaVersion({
      supportedSchemas: ['v1-current', 'v2-flat'],
    });
    const selectedSchema = getSchemaForVersion(schemaVersion);

    // Convert the selected Zod schema to JSON Schema for Gemini structured output
    const geminiResponseSchema = z.toJSONSchema(selectedSchema);

    // Build prompt based on whether this is initial generation or regeneration
    let prompt: string;
    if (isRegeneration) {
      prompt = buildRegenerationMessage(
        request,
        request.feedback,
        options.candidatePool,
        options.planningBrief,
        options.stageOneArtifact,
        options.catalogSeed
      );
    } else {
      prompt = `${SYSTEM_PROMPT}\n\n${JSON.stringify(
        buildInitialGenerationPromptPayload(
          request,
          context,
          options.planningBrief,
          options.candidatePool,
          options.stageOneArtifact,
          options.catalogSeed
        )
      )}`;
    }

    options.promptRecorder?.({
      provider: 'gemini',
      model,
      schemaVersion,
      isRegeneration,
      phase: 'stage-two-generation',
      content: prompt,
    });

    let planPayload: unknown = null;
    let responseId = '';
    const started = Date.now();
    let callRecorded = false;
    try {
      // Use structured output with JSON schema
      const result = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: geminiResponseSchema,
        },
      });

      responseId = result.responseId ?? `gemini-${Date.now()}`;
      recordModelCall(options, {
        provider: 'gemini',
        phase: 'stage-two-generation',
        requestedModel: model,
        resolvedModel: result.modelVersion,
        responseId,
        startedAtMs: started,
        status: 'success',
        tokens: geminiTokenUsage(result.usageMetadata),
        endpoint: useVertex ? 'vertex' : 'standard',
      });
      callRecorded = true;

      const text = (result.text ?? '').trim();
      if (!text) {
        throw new Error('Empty response from Gemini');
      }

      // Parse JSON response
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        throw new Error(`Failed to parse JSON response: ${parseError}`);
      }

      // Validate against selected Zod schema
      planPayload = selectedSchema.parse(parsed);

      log.info('model call completed', {
        provider: 'gemini',
        model,
        useVertexAi: useVertex,
        durationMs: Date.now() - started,
        isRegeneration,
      });
    } catch (error) {
      const originalMessage =
        error instanceof Error ? error.message : String(error);
      const status =
        typeof (error as { status?: number }).status === 'number'
          ? (error as { status?: number }).status
          : undefined;
      if (!callRecorded) {
        recordModelCall(options, {
          provider: 'gemini',
          phase: 'stage-two-generation',
          requestedModel: model,
          startedAtMs: started,
          status: 'error',
          endpoint: useVertex ? 'vertex' : 'standard',
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

    if (!planPayload) {
      throw new AiGenerationError(
        'Provider returned an empty response',
        'INVALID_RESPONSE'
      );
    }

    // Transform LLM response to canonical TodayPlan using transformation layer
    const transformResult = transformLlmResponse(planPayload, {
      schemaVersion,
    });

    if (!transformResult.success) {
      // Treat transformation failures as provider errors
      log.error('transformation failed', {
        provider: 'gemini',
        message: transformResult.error.message,
        schemaVersion: transformResult.schemaVersion,
      });
      throw new AiGenerationError(
        `LLM response transformation failed: ${transformResult.error.message}`,
        'INVALID_RESPONSE'
      );
    }

    // Enrich the transformed plan with provider-specific metadata
    const plan = { ...transformResult.plan, source: 'ai' as const, responseId };

    log.info('transformation succeeded', {
      provider: 'gemini',
      schemaVersion: transformResult.schemaVersion,
    });

    return {
      plan: todayPlanSchema.parse(plan),
      responseId,
      schemaVersion: transformResult.schemaVersion,
    };
  }
}
