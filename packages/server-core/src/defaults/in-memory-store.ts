import type { GenerationStore, GenerationState } from '../types';
import type { GenerationStatus, TodayPlan } from '@workout-agent/shared';

/**
 * In-memory generation store for OSS deployments.
 * Stores generation state in a Map keyed by device token.
 *
 * Production deployments should replace this with Redis or a database-backed store.
 */
export class InMemoryGenerationStore implements GenerationStore {
  private stateByDevice = new Map<string, GenerationState>();

  private createIdleStatus(): GenerationStatus {
    return {
      state: 'idle',
      submittedAt: null,
    };
  }

  private ensureState(deviceToken: string): GenerationState {
    let state = this.stateByDevice.get(deviceToken);
    if (!state) {
      state = {
        plan: null,
        generationStatus: this.createIdleStatus(),
      };
      this.stateByDevice.set(deviceToken, state);
    }
    return state;
  }

  async getState(deviceToken: string): Promise<GenerationState> {
    const state = this.ensureState(deviceToken);
    // Return a deep clone to prevent external mutation
    return {
      plan: state.plan,
      generationStatus: { ...state.generationStatus },
      transformationMetadata: state.transformationMetadata
        ? { ...state.transformationMetadata }
        : undefined,
    };
  }

  async markPending(deviceToken: string, etaSeconds: number): Promise<void> {
    const state = this.ensureState(deviceToken);
    state.generationStatus = {
      state: 'pending',
      submittedAt: new Date().toISOString(),
      etaSeconds,
    };
  }

  async persistPlan(
    deviceToken: string,
    plan: TodayPlan,
    metadata?: { schemaVersion?: string }
  ): Promise<void> {
    const state = this.ensureState(deviceToken);
    state.plan = plan;
    state.generationStatus = this.createIdleStatus();

    // Record transformation metadata if provided; otherwise clear to avoid stale metadata
    state.transformationMetadata = metadata?.schemaVersion
      ? {
          schemaVersion: metadata.schemaVersion,
          transformedAt: new Date().toISOString(),
        }
      : undefined;
  }

  async setError(deviceToken: string, message: string): Promise<void> {
    const state = this.ensureState(deviceToken);
    state.generationStatus = {
      state: 'error',
      submittedAt:
        state.generationStatus.submittedAt ?? new Date().toISOString(),
      message,
    };
  }

  async clearPlan(deviceToken: string): Promise<void> {
    const state = this.ensureState(deviceToken);
    state.plan = null;
    state.generationStatus = this.createIdleStatus();
    state.transformationMetadata = undefined;
  }

  /**
   * Test-only helper to reset the store
   */
  reset(): void {
    this.stateByDevice.clear();
  }
}
