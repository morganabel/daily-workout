import { OpenAIProvider } from './openai';
import OpenAI from 'openai';
import {
  type GenerationRequest,
  type GenerationContext,
  type LlmTodayPlan,
} from '@workout-agent/shared';
import { AiGenerationError } from './types';

jest.mock('openai');
jest.mock('./utils', () => ({
  attachGeneratedIds: jest.fn((plan: LlmTodayPlan) => ({
    id: 'mock-plan-id',
    ...plan,
    blocks: plan.blocks.map((block, i: number) => ({
      id: `mock-block-${i}`,
      ...block,
      exercises: block.exercises.map((ex, j: number) => ({
        id: `mock-exercise-${i}-${j}`,
        ...ex,
      })),
    })),
  })),
}));
jest.mock('../llm-transformer', () => {
  const actual = jest.requireActual('../llm-transformer');
  return {
    ...actual,
    selectSchemaVersion: jest.fn(() => 'v1-current'),
    getSchemaForVersion: jest.fn((version: string) => {
      const { llmTodayPlanSchema } = jest.requireActual('@workout-agent/shared');
      return llmTodayPlanSchema;
    }),
  };
});

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockResponsesParse: jest.Mock;

  const mockRequest: GenerationRequest = {
    focus: 'Pull',
    timeMinutes: 45,
    equipment: ['Barbell', 'Pull-up bar'],
    energy: 'intense',
  };

  const mockContext: GenerationContext = {
    userProfile: {
      experienceLevel: 'advanced',
      energyToday: 'intense',
    },
    preferences: {
      focusBias: ['Pull'],
    },
    environment: {
      equipment: ['Barbell', 'Pull-up bar'],
    },
    recentSessions: [],
  };

  const mockLlmPlan: LlmTodayPlan = {
    focus: 'Pull',
    durationMinutes: 45,
    equipment: ['Barbell', 'Pull-up bar'],
    source: 'ai',
    energy: 'intense',
    summary: 'Pull workout',
    blocks: [
      {
        title: 'Warm Up',
        durationMinutes: 10,
        focus: 'Mobility',
        exercises: [
          {
            name: 'Band Pull-aparts',
            prescription: '2x15',
            detail: 'Focus on shoulder blades',
          },
        ],
      },
      {
        title: 'Main Work',
        durationMinutes: 30,
        focus: 'Pull strength',
        exercises: [
          {
            name: 'Pull-ups',
            prescription: '3x8',
            detail: 'Full range of motion',
          },
          {
            name: 'Barbell Rows',
            prescription: '4x10',
            detail: 'Pull to lower chest',
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OpenAIProvider();

    mockResponsesParse = jest.fn();
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(
      () =>
        ({
          responses: {
            parse: mockResponsesParse,
          },
        }) as unknown as InstanceType<typeof OpenAI>,
    );
  });

  describe('generate', () => {
    it('should successfully generate a workout plan', async () => {
      mockResponsesParse.mockResolvedValue({
        id: 'resp-abc123',
        output_parsed: mockLlmPlan,
      });

      const result = await provider.generate(mockRequest, mockContext, {
        apiKey: 'sk-test-key',
      });

      expect(result.plan.id).toBe('mock-plan-id');
      expect(result.plan.source).toBe('ai');
      expect(result.responseId).toBe('resp-abc123');
      expect(mockResponsesParse).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5-mini',
          reasoning: { effort: 'low' },
          store: true,
          input: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
            }),
            expect.objectContaining({
              role: 'user',
            }),
          ]),
        }),
      );
    });

    it('should use custom model when provided', async () => {
      mockResponsesParse.mockResolvedValue({
        id: 'resp-abc123',
        output_parsed: mockLlmPlan,
      });

      await provider.generate(mockRequest, mockContext, {
        apiKey: 'sk-test-key',
        model: 'gpt-4o',
      });

      expect(mockResponsesParse).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
        }),
      );
    });

    it('should use custom API base URL when provided', async () => {
      mockResponsesParse.mockResolvedValue({
        id: 'resp-abc123',
        output_parsed: mockLlmPlan,
      });

      await provider.generate(mockRequest, mockContext, {
        apiKey: 'sk-test-key',
        apiBaseUrl: 'https://custom-openai.example.com/v1',
      });

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'sk-test-key',
        baseURL: 'https://custom-openai.example.com/v1',
      });
    });

    it('should handle regeneration with previousResponseId', async () => {
      mockResponsesParse.mockResolvedValue({
        id: 'resp-xyz789',
        output_parsed: mockLlmPlan,
      });

      const regenerationRequest: GenerationRequest = {
        ...mockRequest,
        previousResponseId: 'resp-previous-123',
        feedback: ['different-exercises'],
      };

      await provider.generate(regenerationRequest, mockContext, {
        apiKey: 'sk-test-key',
      });

      expect(mockResponsesParse).toHaveBeenCalledWith(
        expect.objectContaining({
          previous_response_id: 'resp-previous-123',
          input: [
            expect.objectContaining({
              role: 'user',
              content: expect.any(String),
            }),
          ],
        }),
      );
    });

    it('should use default API base when not provided', async () => {
      mockResponsesParse.mockResolvedValue({
        id: 'resp-abc123',
        output_parsed: mockLlmPlan,
      });

      await provider.generate(mockRequest, mockContext, {
        apiKey: 'sk-test-key',
      });

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'sk-test-key',
        baseURL: 'https://api.openai.com/v1',
      });
    });

    it('should throw NO_API_KEY error when API key is missing', async () => {
      await expect(
        provider.generate(mockRequest, mockContext, {}),
      ).rejects.toThrow(AiGenerationError);

      try {
        await provider.generate(mockRequest, mockContext, {});
      } catch (error) {
        expect(error).toBeInstanceOf(AiGenerationError);
        expect((error as AiGenerationError).code).toBe('NO_API_KEY');
        expect((error as AiGenerationError).message).toContain(
          'Missing API key',
        );
      }
    });

    it('should throw REQUEST_FAILED error when API call fails', async () => {
      mockResponsesParse.mockRejectedValue(
        new Error('Invalid authentication'),
      );

      await expect(
        provider.generate(mockRequest, mockContext, {
          apiKey: 'sk-test-key',
        }),
      ).rejects.toThrow(AiGenerationError);

      try {
        await provider.generate(mockRequest, mockContext, {
          apiKey: 'sk-test-key',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AiGenerationError);
        expect((error as AiGenerationError).code).toBe('REQUEST_FAILED');
        expect((error as AiGenerationError).message).toContain(
          'Invalid authentication',
        );
      }
    });

    it('should throw INVALID_RESPONSE error when output_parsed is null', async () => {
      mockResponsesParse.mockResolvedValue({
        id: 'resp-abc123',
        output_parsed: null,
      });

      await expect(
        provider.generate(mockRequest, mockContext, {
          apiKey: 'sk-test-key',
        }),
      ).rejects.toThrow(AiGenerationError);

      try {
        await provider.generate(mockRequest, mockContext, {
          apiKey: 'sk-test-key',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AiGenerationError);
        expect((error as AiGenerationError).code).toBe('INVALID_RESPONSE');
        expect((error as AiGenerationError).message).toContain(
          'empty response',
        );
      }
    });

    it('should include status code in error when available', async () => {
      const apiError = Object.assign(new Error('Rate limit exceeded'), {
        status: 429,
      });
      mockResponsesParse.mockRejectedValue(apiError);

      try {
        await provider.generate(mockRequest, mockContext, {
          apiKey: 'sk-test-key',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AiGenerationError);
        expect((error as AiGenerationError).status).toBe(429);
        expect((error as AiGenerationError).message).toContain('(429)');
      }
    });

    it('should attach responseId to the plan', async () => {
      mockResponsesParse.mockResolvedValue({
        id: 'resp-unique-id',
        output_parsed: mockLlmPlan,
      });

      const result = await provider.generate(mockRequest, mockContext, {
        apiKey: 'sk-test-key',
      });

      expect(result.responseId).toBe('resp-unique-id');
      expect(result.plan.responseId).toBe('resp-unique-id');
    });

    it('should pass structured output configuration', async () => {
      mockResponsesParse.mockResolvedValue({
        id: 'resp-abc123',
        output_parsed: mockLlmPlan,
      });

      await provider.generate(mockRequest, mockContext, {
        apiKey: 'sk-test-key',
      });

      expect(mockResponsesParse).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.objectContaining({
            format: expect.any(Object),
          }),
        }),
      );
    });

    it('should log completion time', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockResponsesParse.mockResolvedValue({
        id: 'resp-abc123',
        output_parsed: mockLlmPlan,
      });

      await provider.generate(mockRequest, mockContext, {
        apiKey: 'sk-test-key',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[workouts.generate] model call completed'),
        expect.stringMatching(/\d+\.\d+s/),
        '(initial)',
      );

      consoleSpy.mockRestore();
    });

    it('should indicate regeneration in logs', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockResponsesParse.mockResolvedValue({
        id: 'resp-abc123',
        output_parsed: mockLlmPlan,
      });

      const regenerationRequest: GenerationRequest = {
        ...mockRequest,
        previousResponseId: 'resp-previous-123',
        feedback: ['too-easy'],
      };

      await provider.generate(regenerationRequest, mockContext, {
        apiKey: 'sk-test-key',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[workouts.generate] model call completed'),
        expect.stringMatching(/\d+\.\d+s/),
        '(regeneration)',
      );

      consoleSpy.mockRestore();
    });
  });
});
