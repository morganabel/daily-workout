/**
 * Dependency wiring for the OSS server
 *
 * This module constructs the concrete implementations (OSS defaults)
 * and exports ready-to-use handlers.
 */

import {
  StubAuthProvider,
  InMemoryGenerationStore,
  NoOpUsagePolicy,
  NoOpMeteringSink,
  createSnapshotHandler,
  createGenerateHandler,
  createLogWorkoutHandler,
  type GenerateHandlerConfig,
} from '@workout-agent-ce/server-core';
import { DefaultModelRouter } from '@workout-agent-ce/server-ai';

// Instantiate OSS default dependencies
const auth = new StubAuthProvider();
const store = new InMemoryGenerationStore();
const router = new DefaultModelRouter();
const policy = new NoOpUsagePolicy();
const metering = new NoOpMeteringSink();

// Build server configuration from environment
const config: GenerateHandlerConfig = {
  edition: (process.env.EDITION?.toUpperCase() as 'OSS' | 'HOSTED') ?? 'OSS',
  useVertexAi: process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true',
  googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT,
  googleCloudLocation: process.env.GOOGLE_CLOUD_LOCATION,
  defaultApiKeys: {
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  },
  defaultProvider: (process.env.AI_PROVIDER?.toLowerCase() as 'openai' | 'gemini') ?? 'openai',
};

// Create handlers using the factories
export const snapshotHandler = createSnapshotHandler({ auth, store });
export const generateHandler = createGenerateHandler({
  auth,
  store,
  router,
  policy,
  metering,
  config,
});
export const logWorkoutHandler = createLogWorkoutHandler({ auth, store });

// Export the store instance for legacy code that needs direct access
// TODO: Remove this once all code uses handlers
export { store as legacyGenerationStore };
