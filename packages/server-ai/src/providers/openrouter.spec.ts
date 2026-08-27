import type {
  ExerciseCandidatePool,
  StageOnePlannerArtifact,
} from '@leveza/server-core';
import type {
  GenerationContext,
  GenerationRequest,
  LlmTodayPlan,
} from '@leveza/shared';
import {
  getDefaultSchemaVersion,
  transformLlmResponse,
} from '../llm-transformer';
import { OpenRouterProvider } from './openrouter';
import { AiGenerationError } from './types';

jest.mock('uuid', () => ({
  v7: jest.fn(() => 'mock-uuid'),
}));
jest.mock('@openrouter/sdk', () => ({
  OpenRouter: jest.fn(),
}));
jest.mock('../llm-transformer', () => {
  const actual = jest.requireActual('../llm-transformer');
  return {
    ...actual,
    transformLlmResponse: jest.fn(),
    getDefaultSchemaVersion: jest.fn(() => 'v1-current'),
    getSchemaForVersion: jest.fn(() => {
      const { llmTodayPlanSchema } = jest.requireActual(
        '@leveza/shared'
      );
      return llmTodayPlanSchema;
    }),
  };
});

describe('OpenRouterProvider', () => {
  const request: GenerationRequest = {
    focus: 'Push',
    timeMinutes: 30,
    equipment: ['Dumbbells'],
    energy: 'moderate',
  };
  const context: GenerationContext = {
    userProfile: {
      experienceLevel: 'intermediate',
      energyToday: 'moderate',
    },
    preferences: { focusBias: ['Push'] },
    environment: { equipment: ['Dumbbells'] },
    recentSessions: [],
  };
  const llmPlan: LlmTodayPlan = {
    focus: 'Push',
    durationMinutes: 30,
    equipment: ['Dumbbells'],
    source: 'ai',
    energy: 'moderate',
    summary: 'Push workout',
    blocks: [
      {
        title: 'Strength',
        durationMinutes: 30,
        focus: 'Push',
        exercises: [
          {
            name: 'Dumbbell Press',
            prescription: '3 x 10',
            detail: 'Controlled tempo',
          },
        ],
      },
    ],
  };
  const stageOneArtifact: StageOnePlannerArtifact = {
    mode: 'llm-assisted',
    confidence: 'high',
    planningIntent: 'Build a focused push workout.',
    resolvedFocus: 'Push',
    protectStressors: [],
    avoidStressors: [],
    styleBiases: ['strength'],
    loadBias: 'moderate',
    noveltyTarget: 'medium',
    selectionIntent: 'balanced_upper',
    rerankHints: ['prefer pressing movements'],
    candidateInstructions: ['use available dumbbells'],
  };
  const candidatePool: ExerciseCandidatePool = {
    libraryVersion: 'test-library',
    totalEligibleCount: 1,
    baselineExerciseIds: [],
    candidateExercises: [{ id: 'test:dumbbell-press', name: 'Dumbbell Press' }],
  };

  let send: jest.Mock;
  let client: { chat: { send: jest.Mock } };

  beforeEach(() => {
    jest.clearAllMocks();
    (getDefaultSchemaVersion as jest.Mock).mockReturnValue('v1-current');
    (transformLlmResponse as jest.Mock).mockReturnValue({
      success: true,
      plan: {
        id: 'plan-id',
        ...llmPlan,
        blocks: llmPlan.blocks.map((block, blockIndex) => ({
          id: `block-${blockIndex}`,
          ...block,
          exercises: block.exercises.map((exercise, exerciseIndex) => ({
            id: `exercise-${blockIndex}-${exerciseIndex}`,
            ...exercise,
          })),
        })),
      },
      schemaVersion: 'v1-current',
    });
    send = jest.fn();
    client = { chat: { send } };
  });

  it('uses the requested DeepSeek model and strict structured output for generation', async () => {
    send.mockResolvedValue({
      id: 'openrouter-response-id',
      choices: [{ message: { content: JSON.stringify(llmPlan) } }],
    });

    const result = await new OpenRouterProvider().generate(request, context, {
      client,
      candidatePool,
    });

    expect(result.responseId).toBe('openrouter-response-id');
    expect(result.plan.id).toBe('plan-id');
    expect(send).toHaveBeenCalledWith({
      chatRequest: expect.objectContaining({
        model: 'deepseek/deepseek-v4-flash-0731',
        reasoningEffort: 'none',
        provider: { requireParameters: true },
        stream: false,
        responseFormat: expect.objectContaining({
          type: 'json_schema',
          jsonSchema: expect.objectContaining({
            name: 'today_plan',
            strict: true,
          }),
        }),
      }),
    });
  });

  it('configures a bounded timeout on the OpenRouter SDK client', async () => {
    const { OpenRouter } = await import('@openrouter/sdk');
    const OpenRouterConstructor = OpenRouter as unknown as jest.Mock;
    OpenRouterConstructor.mockReturnValue(client);
    send.mockResolvedValue({
      id: 'openrouter-response-id',
      choices: [{ message: { content: JSON.stringify(llmPlan) } }],
    });

    await new OpenRouterProvider().generate(request, context, {
      apiKey: 'test-openrouter-key',
      candidatePool,
    });

    expect(OpenRouterConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: 60_000,
      })
    );
  });

  it('uses the same requested model for stage-one planning', async () => {
    send.mockResolvedValue({
      id: 'planner-response-id',
      choices: [{ message: { content: JSON.stringify(stageOneArtifact) } }],
    });

    const result = await new OpenRouterProvider().planStageOne(
      request,
      context,
      { client, candidatePool }
    );

    expect(result).toEqual(stageOneArtifact);
    expect(send).toHaveBeenCalledWith({
      chatRequest: expect.objectContaining({
        model: 'deepseek/deepseek-v4-flash-0731',
        reasoningEffort: 'none',
        provider: { requireParameters: true },
        responseFormat: expect.objectContaining({
          jsonSchema: expect.objectContaining({
            name: 'stage_one_planner',
          }),
        }),
      }),
    });
  });

  it('rebuilds regeneration context instead of sending a prior response id', async () => {
    send.mockResolvedValue({
      id: 'regenerated-response-id',
      choices: [{ message: { content: JSON.stringify(llmPlan) } }],
    });

    await new OpenRouterProvider().generate(
      {
        ...request,
        previousResponseId: 'prior-openai-response',
        baselineWorkout: {
          id: 'baseline-id',
          ...llmPlan,
          blocks: llmPlan.blocks.map((block, blockIndex) => ({
            id: `baseline-block-${blockIndex}`,
            ...block,
            exercises: block.exercises.map((exercise, exerciseIndex) => ({
              id: `baseline-exercise-${blockIndex}-${exerciseIndex}`,
              ...exercise,
            })),
          })),
        },
        feedback: ['different-exercises'],
      },
      context,
      { client }
    );

    const call = send.mock.calls[0][0];
    expect(call.chatRequest.messages).toHaveLength(1);
    expect(call.chatRequest.messages[0].content).toContain(
      'Baseline exercises: Dumbbell Press'
    );
    expect(JSON.stringify(call)).not.toContain('previous_response_id');
  });

  it('supports an explicit model override', async () => {
    send.mockResolvedValue({
      id: 'custom-response-id',
      choices: [{ message: { content: JSON.stringify(llmPlan) } }],
    });

    await new OpenRouterProvider().generate(request, context, {
      client,
      model: 'openrouter/custom-model',
    });

    expect(send).toHaveBeenCalledWith({
      chatRequest: expect.objectContaining({
        model: 'openrouter/custom-model',
      }),
    });
  });

  it('rejects a missing API key when no client is injected', async () => {
    await expect(
      new OpenRouterProvider().generate(request, context, {})
    ).rejects.toMatchObject<Partial<AiGenerationError>>({
      code: 'NO_API_KEY',
    });
  });

  it('maps upstream status codes into provider errors', async () => {
    send.mockRejectedValue(
      Object.assign(new Error('rate limited'), { status: 429 })
    );

    await expect(
      new OpenRouterProvider().generate(request, context, { client })
    ).rejects.toMatchObject<Partial<AiGenerationError>>({
      code: 'REQUEST_FAILED',
      status: 429,
      message: expect.stringContaining('rate limited'),
    });
  });

  it('rejects empty provider output', async () => {
    send.mockResolvedValue({
      id: 'empty-response-id',
      choices: [{ message: { content: '' } }],
    });

    await expect(
      new OpenRouterProvider().generate(request, context, { client })
    ).rejects.toMatchObject<Partial<AiGenerationError>>({
      code: 'REQUEST_FAILED',
      message: expect.stringContaining('Empty response from OpenRouter'),
    });
  });

  it('rejects invalid JSON provider output', async () => {
    send.mockResolvedValue({
      id: 'invalid-response-id',
      choices: [{ message: { content: 'not-json' } }],
    });

    await expect(
      new OpenRouterProvider().generate(request, context, { client })
    ).rejects.toMatchObject<Partial<AiGenerationError>>({
      code: 'REQUEST_FAILED',
    });
  });
});
