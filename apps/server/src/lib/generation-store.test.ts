import {
  getGenerationState,
  markGenerationPending,
  persistGeneratedPlan,
  setGenerationError,
  clearStoredPlan,
  resetGenerationStore,
} from './generation-store';
import { createTodayPlanMock } from '@workout-agent/shared';

const DEVICE_TOKEN = 'device-test-token';

describe('generation-store', () => {
  beforeEach(() => {
    resetGenerationStore();
  });

  it('initializes with idle status', () => {
    const state = getGenerationState(DEVICE_TOKEN);
    expect(state.plan).toBeNull();
    expect(state.generationStatus.state).toBe('idle');
  });

  it('marks pending and then persists plan', () => {
    markGenerationPending(DEVICE_TOKEN, 20);
    let state = getGenerationState(DEVICE_TOKEN);
    expect(state.generationStatus.state).toBe('pending');
    expect(state.generationStatus.etaSeconds).toBe(20);

    const plan = createTodayPlanMock({ id: 'plan-123' });
    persistGeneratedPlan(DEVICE_TOKEN, plan);

    state = getGenerationState(DEVICE_TOKEN);
    expect(state.plan?.id).toBe('plan-123');
    expect(state.generationStatus.state).toBe('idle');
  });

  it('records errors without overwriting stored plan', () => {
    const plan = createTodayPlanMock({ id: 'plan-existing' });
    persistGeneratedPlan(DEVICE_TOKEN, plan);

    setGenerationError(DEVICE_TOKEN, 'provider failure');
    const state = getGenerationState(DEVICE_TOKEN);

    expect(state.plan?.id).toBe('plan-existing');
    expect(state.generationStatus.state).toBe('error');
    expect(state.generationStatus.message).toBe('provider failure');
  });

  it('clears plan on request', () => {
    const plan = createTodayPlanMock({ id: 'plan-existing' });
    persistGeneratedPlan(DEVICE_TOKEN, plan);

    clearStoredPlan(DEVICE_TOKEN);
    const state = getGenerationState(DEVICE_TOKEN);
    expect(state.plan).toBeNull();
    expect(state.generationStatus.state).toBe('idle');
  });

  it('records and clears transformation metadata with plan updates', () => {
    const planA = createTodayPlanMock({ id: 'plan-a' });
    persistGeneratedPlan(DEVICE_TOKEN, planA, { schemaVersion: 'v1-current' });

    let state = getGenerationState(DEVICE_TOKEN);
    expect(state.transformationMetadata?.schemaVersion).toBe('v1-current');
    expect(typeof state.transformationMetadata?.transformedAt).toBe('string');

    // Persist a mock/legacy plan (no schemaVersion) and ensure metadata is cleared
    const planB = createTodayPlanMock({ id: 'plan-b' });
    persistGeneratedPlan(DEVICE_TOKEN, planB);

    state = getGenerationState(DEVICE_TOKEN);
    expect(state.plan?.id).toBe('plan-b');
    expect(state.transformationMetadata).toBeUndefined();
  });
});
