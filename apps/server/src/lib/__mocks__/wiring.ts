/**
 * Mock wiring for tests
 * This prevents the real wiring from instantiating SDKs during tests
 */

export const snapshotHandler = jest.fn();
export const generateHandler = jest.fn();
export const logWorkoutHandler = jest.fn();

// Export a mock store for tests that need direct access
export const legacyGenerationStore = {
  getState: jest.fn(),
  markPending: jest.fn(),
  persistPlan: jest.fn(),
  setError: jest.fn(),
  clearPlan: jest.fn(),
  reset: jest.fn(),
};
