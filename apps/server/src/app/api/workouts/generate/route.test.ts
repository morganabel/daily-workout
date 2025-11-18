jest.mock('uuid', () => ({
  v7: jest.fn(() => 'mock-uuid'),
}));

/**
 * Tests for POST /api/workouts/generate route
 */

import { POST } from './route';
import { authenticateRequest } from '@/lib/auth';
import { generateTodayPlanAI } from '@/lib/generator';
import { loadGenerationContext } from '@/lib/context';
import type { TodayPlan } from '@workout-agent/shared';
import { createGenerationContextMock, createTodayPlanMock } from '@workout-agent/shared';
import {
  getGenerationState,
  resetGenerationStore,
  persistGeneratedPlan,
} from '@/lib/generation-store';

// Mock dependencies
jest.mock('@/lib/auth');
jest.mock('@/lib/generator');
jest.mock('@/lib/context');

const mockAuthenticateRequest = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;
const mockGenerateTodayPlanAI = generateTodayPlanAI as jest.MockedFunction<typeof generateTodayPlanAI>;
const mockLoadGenerationContext = loadGenerationContext as jest.MockedFunction<typeof loadGenerationContext>;

describe('POST /api/workouts/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.EDITION;
    delete process.env.OPENAI_API_KEY;
    mockGenerateTodayPlanAI.mockReset();
    mockLoadGenerationContext.mockResolvedValue(createGenerationContextMock());
    resetGenerationStore();
  });

  it('should generate workout plan when authenticated', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const requestBody = {
      timeMinutes: 30,
      focus: 'Full Body',
      equipment: ['Bodyweight'],
      energy: 'moderate' as const,
    };

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('focus');
    expect(data).toHaveProperty('durationMinutes');
    expect(data).toHaveProperty('equipment');
    expect(data).toHaveProperty('blocks');
    expect(data.focus).toBe('Full Body');
    expect(data.durationMinutes).toBe(30);

    const state = getGenerationState('test-token');
    expect(state.plan).not.toBeNull();
    expect(state.generationStatus.state).toBe('idle');
  });

  it('should call AI provider when API key is available', async () => {
    process.env.OPENAI_API_KEY = 'test-api-key';
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const providerPlan: TodayPlan = {
      id: 'plan-ai',
      focus: 'AI Focus',
      durationMinutes: 42,
      equipment: ['Kettlebell'],
      source: 'ai',
      energy: 'intense',
      summary: 'AI generated plan',
      blocks: [
        {
          id: 'block-1',
          title: 'Block',
          durationMinutes: 10,
          focus: 'Strength',
          exercises: [
            { id: 'ex-1', name: 'Swing', prescription: '3 x 12', detail: null },
          ],
        },
      ],
    };

    mockGenerateTodayPlanAI.mockResolvedValue(providerPlan);

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ timeMinutes: 42 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(mockLoadGenerationContext).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({ timeMinutes: 42 }),
    );
    expect(mockGenerateTodayPlanAI).toHaveBeenCalledWith(
      expect.objectContaining({ timeMinutes: 42 }),
      expect.anything(),
      expect.objectContaining({ apiKey: 'test-api-key' }),
    );
    expect(response.status).toBe(200);
    expect(data.id).toBe('plan-ai');
    expect(data.durationMinutes).toBe(42);
  });

  it('should fall back to mock when AI provider fails', async () => {
    process.env.OPENAI_API_KEY = 'test-api-key';
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });
    mockGenerateTodayPlanAI.mockRejectedValue(new Error('provider failure'));

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ timeMinutes: 25, focus: 'Conditioning' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(mockGenerateTodayPlanAI).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(data.focus).toBe('Conditioning');
    expect(data.durationMinutes).toBe(25);

    const state = getGenerationState('test-token');
    expect(state.generationStatus.state).toBe('error');
  });

  it('should retain previously persisted plan on provider failure', async () => {
    process.env.OPENAI_API_KEY = 'test-api-key';
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });
    mockGenerateTodayPlanAI.mockRejectedValue(new Error('provider failure'));

    const previousPlan = createTodayPlanMock({ id: 'existing-plan' });
    persistGeneratedPlan('test-token', previousPlan);

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ timeMinutes: 25 }),
    });

    await POST(request);
    const state = getGenerationState('test-token');
    expect(state.plan?.id).toBe('existing-plan');
    expect(state.generationStatus.state).toBe('error');
  });

  it('should return 401 when not authenticated', async () => {
    mockAuthenticateRequest.mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe('UNAUTHORIZED');
  });

  it('should return 400 for invalid request body', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ invalid: 'data' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should return BYOK_REQUIRED when in hosted mode without API key', async () => {
    process.env.EDITION = 'HOSTED';
    delete process.env.OPENAI_API_KEY;

    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const requestBody = {
      timeMinutes: 30,
      focus: 'Full Body',
      equipment: ['Bodyweight'],
      energy: 'moderate' as const,
    };

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(402);
    expect(data.code).toBe('BYOK_REQUIRED');
    expect(data.message).toContain('API key');
  });

  it('should accept BYOK header even when env key missing', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });
    mockGenerateTodayPlanAI.mockResolvedValue({
      id: 'plan-from-header',
      focus: 'Header Plan',
      durationMinutes: 35,
      equipment: ['Bands'],
      source: 'ai',
      energy: 'moderate',
      summary: 'Plan',
      blocks: [
        {
          id: 'b1',
          title: 'Main',
          durationMinutes: 15,
          focus: 'Strength',
          exercises: [{ id: 'e1', name: 'Row', prescription: '3 x 12', detail: null }],
        },
      ],
    });

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
        'x-openai-key': 'header-key',
      },
      body: JSON.stringify({ timeMinutes: 35 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(mockGenerateTodayPlanAI).toHaveBeenCalledWith(
      expect.any(Object),
      expect.anything(),
      expect.objectContaining({ apiKey: 'header-key' }),
    );
    expect(data.id).toBe('plan-from-header');
  });

  it('should accept optional fields', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const requestBody = {
      timeMinutes: 45,
    };

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.durationMinutes).toBe(45);
  });

  it('should handle invalid JSON gracefully', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: 'invalid json',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });
});
