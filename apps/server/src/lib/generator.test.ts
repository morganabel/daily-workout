jest.mock('uuid', () => ({
  v7: jest.fn(() => 'mock-uuid'),
}));

import { generateTodayPlanAI, AiGenerationError } from './generator';
import {
  createGenerationContextMock,
  type GenerationRequest,
  type LlmTodayPlan,
} from '@workout-agent/shared';
import type OpenAI from 'openai';
import { v7 as uuidv7 } from 'uuid';
import { registerProvider, resetProviders } from './ai-providers/registry';
import type { AiProvider, AiProviderOptions, GenerationResult } from './ai-providers/types';

const baseRequest: GenerationRequest = {
  timeMinutes: 30,
  focus: 'Upper Body',
  equipment: ['Dumbbells'],
  energy: 'moderate',
};

const mockLlmPlan: LlmTodayPlan = {
  focus: 'Upper Body Strength',
  durationMinutes: 30,
  equipment: ['Dumbbells'],
  source: 'ai' as const,
  energy: 'moderate' as const,
  summary: 'Sample plan',
  blocks: [
    {
      title: 'Warm-up',
      durationMinutes: 5,
      focus: 'Prep',
      exercises: [
        {
          name: 'Jumping Jacks',
          prescription: '2 x 30s',
          detail: null,
        },
      ],
    },
  ],
};

const createMockClient = (parsedValue: typeof mockLlmPlan | null) => {
  const parse = jest.fn().mockResolvedValue({
    output_parsed: parsedValue,
  });
  const client = {
    responses: {
      parse,
    },
  } as unknown as OpenAI;
  return { client, parse };
};

class TestProvider implements AiProvider {
  async generate(
    _request: GenerationRequest,
    _context: ReturnType<typeof createGenerationContextMock>,
    options: AiProviderOptions,
  ): Promise<GenerationResult> {
    if (!options.apiKey) {
      throw new AiGenerationError('Missing API key', 'NO_API_KEY');
    }
    const client = (options as { client?: OpenAI }).client;
    if (!client) {
      throw new AiGenerationError('Missing client', 'REQUEST_FAILED');
    }
    const model = options.model ?? 'test-model';
    let parseResult;
    try {
      parseResult = await client.responses.parse({ model });
    } catch (error) {
      const status =
        typeof (error as { status?: number }).status === 'number'
          ? (error as { status?: number }).status
          : undefined;
      throw new AiGenerationError(
        `Provider request failed${status ? ` (${status})` : ''}: ${(error as Error).message}`,
        'REQUEST_FAILED',
        status,
      );
    }
    const payload = parseResult.output_parsed as LlmTodayPlan | null;
    if (!payload) {
      throw new AiGenerationError('Provider returned an empty response', 'INVALID_RESPONSE');
    }
    const withIds = {
      id: uuidv7(),
      ...payload,
      blocks: payload.blocks.map((block) => ({
        id: uuidv7(),
        ...block,
        exercises: block.exercises.map((exercise) => ({
          id: uuidv7(),
          ...exercise,
        })),
      })),
    };
    return { plan: withIds, responseId: 'test-response-id' };
  }
}

describe('generateTodayPlanAI', () => {
  const mockUuid = uuidv7 as jest.MockedFunction<typeof uuidv7>;

  beforeEach(() => {
    resetProviders();
    mockUuid.mockClear();
    let counter = 0;
    mockUuid.mockImplementation(
      (..._args: Parameters<typeof uuidv7>): ReturnType<typeof uuidv7> =>
        (`mock-uuid-${++counter}` as unknown as ReturnType<typeof uuidv7>),
    );
    registerProvider('openai', new TestProvider());
  });

  it('parses provider JSON response', async () => {
    const { client, parse } = createMockClient(mockLlmPlan);
    const context = createGenerationContextMock();

    const result = await generateTodayPlanAI(
      baseRequest,
      context,
      {
        apiKey: 'test-key',
        client,
        model: 'test-model',
        apiBaseUrl: 'https://example.com/v1',
      },
    );

    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-model',
      }),
    );
    expect(result.plan.focus).toBe(mockLlmPlan.focus);
    expect(result.plan.blocks).toHaveLength(mockLlmPlan.blocks.length);
    expect(result.plan.blocks[0].exercises[0]).toHaveProperty('id');
    expect(result.plan).toHaveProperty('id');
  });

  it('throws when provider response is invalid', async () => {
    const { client } = createMockClient(null);
    const context = createGenerationContextMock();

    await expect(
      generateTodayPlanAI(baseRequest, context, { apiKey: 'test-key', client }),
    ).rejects.toBeInstanceOf(AiGenerationError);
  });

  it('throws when provider request fails', async () => {
    const parse = jest.fn().mockRejectedValue(
      Object.assign(new Error('fail'), { status: 500 }),
    );
    const client = {
      responses: { parse },
    } as unknown as OpenAI;
    const context = createGenerationContextMock();

    await expect(
      generateTodayPlanAI(baseRequest, context, { apiKey: 'test-key', client }),
    ).rejects.toEqual(
      expect.objectContaining({ code: 'REQUEST_FAILED', status: 500 }),
    );
  });

  it('throws when API key missing', async () => {
    const context = createGenerationContextMock();
    await expect(
      generateTodayPlanAI(baseRequest, context, { apiKey: '' }),
    ).rejects.toEqual(expect.objectContaining({ code: 'NO_API_KEY' }));
  });
});
