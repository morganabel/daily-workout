import { GeminiProvider } from './gemini';
import { GoogleGenAI } from '@google/genai';
import type {
  GenerationRequest,
  GenerationContext,
  LlmTodayPlan,
} from '@workout-agent/shared';
import { AiGenerationError } from './types';
import { transformLlmResponse, getDefaultSchemaVersion } from '../llm-transformer';

jest.mock('@google/genai');
jest.mock('../llm-transformer', () => ({
  transformLlmResponse: jest.fn(),
  getDefaultSchemaVersion: jest.fn(),
}));

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  let mockGenerateContent: jest.Mock;

  const mockRequest: GenerationRequest = {
    focus: 'Push',
    timeMinutes: 30,
    equipment: ['Dumbbells'],
    energy: 'moderate',
  };

  const mockContext: GenerationContext = {
    userProfile: {
      experienceLevel: 'intermediate',
      energyToday: 'moderate',
    },
    preferences: {
      focusBias: ['Push'],
    },
    environment: {
      equipment: ['Dumbbells'],
    },
    recentSessions: [],
  };

  const mockLlmPlan: LlmTodayPlan = {
    focus: 'Push',
    durationMinutes: 30,
    equipment: ['Dumbbells'],
    source: 'ai',
    energy: 'moderate',
    summary: 'Push workout',
    blocks: [
      {
        title: 'Warm Up',
        durationMinutes: 10,
        focus: 'Mobility',
        exercises: [
          {
            name: 'Arm Circles',
            prescription: '2x10',
            detail: 'Both directions',
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GeminiProvider();

    (getDefaultSchemaVersion as unknown as jest.Mock).mockReturnValue('v1-current');

    const transformedPlan = {
      id: 'mock-plan-id',
      ...mockLlmPlan,
      source: 'mock',
      blocks: mockLlmPlan.blocks.map((block, i: number) => ({
        id: `mock-block-${i}`,
        ...block,
        exercises: block.exercises.map((ex, j: number) => ({
          id: `mock-exercise-${i}-${j}`,
          ...ex,
        })),
      })),
    };

    (transformLlmResponse as unknown as jest.Mock).mockReturnValue({
      success: true,
      plan: transformedPlan,
      schemaVersion: 'v1-current',
    });

    mockGenerateContent = jest.fn();
    (GoogleGenAI as jest.MockedClass<typeof GoogleGenAI>).mockImplementation(
      () =>
        ({
          models: {
            generateContent: mockGenerateContent,
          },
        }) as unknown as InstanceType<typeof GoogleGenAI>,
    );
  });

  describe('generate', () => {
    it('should successfully generate a workout plan', async () => {
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(mockLlmPlan),
      });

      const result = await provider.generate(mockRequest, mockContext, {
        apiKey: 'test-api-key',
      });

      expect(result.plan.id).toBe('mock-plan-id');
      expect(result.plan.source).toBe('ai');
      expect(result.responseId).toMatch(/^gemini-/);
      expect(result.schemaVersion).toBe('v1-current');
      expect(getDefaultSchemaVersion).toHaveBeenCalled();
      expect(transformLlmResponse).toHaveBeenCalledWith(mockLlmPlan, {
        schemaVersion: 'v1-current',
      });
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-3-flash-preview',
          config: {
            responseMimeType: 'application/json',
            responseSchema: expect.any(Object),
          },
        }),
      );
    });

    it('should use custom model when provided', async () => {
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(mockLlmPlan),
      });

      await provider.generate(mockRequest, mockContext, {
        apiKey: 'test-api-key',
        model: 'gemini-2.0-pro',
      });

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.0-pro',
        }),
      );
    });

    it('should use custom API base URL when provided', async () => {
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(mockLlmPlan),
      });

      await provider.generate(mockRequest, mockContext, {
        apiKey: 'test-api-key',
        apiBaseUrl: 'https://custom-api.example.com',
      });

      expect(GoogleGenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://custom-api.example.com',
        }),
      );
    });

    it('should use Vertex AI when useVertexAi option is true', async () => {
      const oldProject = process.env.GOOGLE_CLOUD_PROJECT;
      const oldLocation = process.env.GOOGLE_CLOUD_LOCATION;
      process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
      process.env.GOOGLE_CLOUD_LOCATION = 'us-central1';

      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(mockLlmPlan),
      });

      await provider.generate(mockRequest, mockContext, {
        useVertexAi: true,
      });

      expect(GoogleGenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'test-project',
          location: 'us-central1',
        }),
      );

      process.env.GOOGLE_CLOUD_PROJECT = oldProject;
      process.env.GOOGLE_CLOUD_LOCATION = oldLocation;
    });

    it('should handle regeneration with feedback', async () => {
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(mockLlmPlan),
      });

      const regenerationRequest: GenerationRequest = {
        ...mockRequest,
        previousResponseId: 'prev-response-123',
        feedback: ['too-hard'],
      };

      await provider.generate(regenerationRequest, mockContext, {
        apiKey: 'test-api-key',
      });

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.any(String),
        }),
      );
    });

    it('should throw NO_API_KEY error when API key is missing and not using Vertex AI', async () => {
      await expect(
        provider.generate(mockRequest, mockContext, {}),
      ).rejects.toThrow(AiGenerationError);

      try {
        await provider.generate(mockRequest, mockContext, {});
      } catch (error) {
        expect(error).toBeInstanceOf(AiGenerationError);
        expect((error as AiGenerationError).code).toBe('NO_API_KEY');
      }
    });

    it('should throw REQUEST_FAILED error when API call fails', async () => {
      mockGenerateContent.mockRejectedValue(
        new Error('Network error'),
      );

      await expect(
        provider.generate(mockRequest, mockContext, {
          apiKey: 'test-api-key',
        }),
      ).rejects.toThrow(AiGenerationError);

      try {
        await provider.generate(mockRequest, mockContext, {
          apiKey: 'test-api-key',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AiGenerationError);
        expect((error as AiGenerationError).code).toBe('REQUEST_FAILED');
      }
    });

    it('should throw REQUEST_FAILED error when response is empty', async () => {
      mockGenerateContent.mockResolvedValue({
        text: '',
      });

      await expect(
        provider.generate(mockRequest, mockContext, {
          apiKey: 'test-api-key',
        }),
      ).rejects.toThrow(AiGenerationError);

      try {
        await provider.generate(mockRequest, mockContext, {
          apiKey: 'test-api-key',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AiGenerationError);
        expect((error as AiGenerationError).code).toBe('REQUEST_FAILED');
      }
    });

    it('should throw REQUEST_FAILED error when JSON parsing fails', async () => {
      mockGenerateContent.mockResolvedValue({
        text: 'not valid json',
      });

      await expect(
        provider.generate(mockRequest, mockContext, {
          apiKey: 'test-api-key',
        }),
      ).rejects.toThrow(AiGenerationError);

      try {
        await provider.generate(mockRequest, mockContext, {
          apiKey: 'test-api-key',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AiGenerationError);
        expect((error as AiGenerationError).code).toBe('REQUEST_FAILED');
      }
    });

    it('should throw REQUEST_FAILED error when schema validation fails', async () => {
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify({ invalid: 'data' }),
      });

      await expect(
        provider.generate(mockRequest, mockContext, {
          apiKey: 'test-api-key',
        }),
      ).rejects.toThrow(AiGenerationError);

      try {
        await provider.generate(mockRequest, mockContext, {
          apiKey: 'test-api-key',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AiGenerationError);
        expect((error as AiGenerationError).code).toBe('REQUEST_FAILED');
      }
    });

    it('should include status code in error when available', async () => {
      const apiError = Object.assign(new Error('Rate limit exceeded'), {
        status: 429,
      });
      mockGenerateContent.mockRejectedValue(apiError);

      try {
        await provider.generate(mockRequest, mockContext, {
          apiKey: 'test-api-key',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AiGenerationError);
        expect((error as AiGenerationError).status).toBe(429);
        expect((error as AiGenerationError).message).toContain('(429)');
      }
    });
  });
});
