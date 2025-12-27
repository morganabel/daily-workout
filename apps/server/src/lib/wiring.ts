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

const allowedEditions = new Set(['OSS', 'HOSTED'] as const);
const allowedProviders = new Set(['openai', 'gemini'] as const);

const buildConfig = (): GenerateHandlerConfig => {
  const rawEdition = process.env.EDITION?.toUpperCase();
  if (rawEdition && !allowedEditions.has(rawEdition as 'OSS' | 'HOSTED')) {
    throw new Error(`Invalid EDITION value: ${rawEdition}`);
  }

  const edition = (rawEdition as 'OSS' | 'HOSTED') ?? 'OSS';
  if (edition !== 'OSS') {
    throw new Error(`OSS server wiring does not support EDITION=${edition}`);
  }

  const rawProvider = process.env.AI_PROVIDER?.toLowerCase();
  if (rawProvider && !allowedProviders.has(rawProvider as 'openai' | 'gemini')) {
    throw new Error(`Invalid AI_PROVIDER value: ${rawProvider}`);
  }

  const useVertexAi = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
  const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
  const googleCloudLocation = process.env.GOOGLE_CLOUD_LOCATION;
  if (useVertexAi && (!googleCloudProject || !googleCloudLocation)) {
    throw new Error('Vertex AI requires GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION.');
  }

  return {
    edition,
    useVertexAi,
    googleCloudProject,
    googleCloudLocation,
    defaultApiKeys: {
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
    },
    defaultProvider: (rawProvider as 'openai' | 'gemini') ?? 'openai',
  };
};

// Build server configuration from environment
const config = buildConfig();

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
