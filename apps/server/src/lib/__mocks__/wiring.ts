/**
 * Mock wiring for tests
 * This prevents the real wiring from instantiating SDKs during tests
 */

export const generateHandler = jest.fn();
export const logWorkoutHandler = jest.fn();
