/**
 * Dependency wiring for the CE server
 *
 * This module constructs the concrete implementations (CE defaults)
 * and exports ready-to-use handlers.
 *
 * Auth mode selection:
 * - If DATABASE_URL is set → Better Auth (real user accounts)
 * - Otherwise → Stub Auth (any bearer token accepted)
 */

import {
  InMemoryGenerationStore,
  NoOpUsagePolicy,
  NoOpMeteringSink,
  createGenerateHandler,
  type GenerateHandlerConfig,
  type MeteringSink,
  type UsagePolicy,
} from '@workout-agent-ce/server-core';
import {
  DefaultModelRouter,
  DefaultStageOnePlanner,
} from '@workout-agent-ce/server-ai';
import type { ExerciseLibrary } from '@workout-agent-ce/server-exercise-library';
import { getAuthContext } from './auth-context';
import {
  hostedBillingRuntime,
  HostedUsagePolicy,
  isHostedBillingEnabled,
} from './hosted-billing';

// Get auth provider from auth context (supports both stub and Better Auth)
const { provider: auth } = getAuthContext();
const store = new InMemoryGenerationStore();
const router = new DefaultModelRouter();
const planner = new DefaultStageOnePlanner();
let cachedExerciseLibrary: ExerciseLibrary | null | undefined;

const loadExerciseLibrary = async (): Promise<ExerciseLibrary | undefined> => {
  if (cachedExerciseLibrary !== undefined) {
    return cachedExerciseLibrary ?? undefined;
  }

  try {
    const { openExerciseLibrary } = await import(
      '@workout-agent-ce/server-exercise-library'
    );
    cachedExerciseLibrary = openExerciseLibrary();
  } catch (error) {
    console.warn(
      `[exercise-library] unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    cachedExerciseLibrary = null;
  }

  return cachedExerciseLibrary ?? undefined;
};

const allowedEditions = new Set(['CE', 'HOSTED'] as const);
const allowedProviders = new Set(['openai', 'gemini'] as const);

const buildConfig = (): GenerateHandlerConfig => {
  const rawEdition = process.env.EDITION?.toUpperCase();
  if (rawEdition && !allowedEditions.has(rawEdition as 'CE' | 'HOSTED')) {
    throw new Error(`Invalid EDITION value: ${rawEdition}`);
  }

  const edition = (rawEdition as 'CE' | 'HOSTED') ?? 'CE';

  const rawProvider = process.env.AI_PROVIDER?.toLowerCase();
  if (
    rawProvider &&
    !allowedProviders.has(rawProvider as 'openai' | 'gemini')
  ) {
    throw new Error(`Invalid AI_PROVIDER value: ${rawProvider}`);
  }

  const useVertexAi = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
  const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
  const googleCloudLocation = process.env.GOOGLE_CLOUD_LOCATION;
  if (useVertexAi && (!googleCloudProject || !googleCloudLocation)) {
    throw new Error(
      'Vertex AI requires GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION.'
    );
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
    enableStageOnePlanner: process.env.ENABLE_STAGE_ONE_PLANNER !== 'false',
  };
};

// Build server configuration from environment
const config = buildConfig();
const hostedBilling = config.edition === 'HOSTED' && isHostedBillingEnabled();

if (hostedBilling && process.env.NODE_ENV !== 'test') {
  console.warn(
    '[billing] Hosted billing runtime stores quota/entitlement state in memory only; restart will reset state.'
  );
}

export const usagePolicy: UsagePolicy = hostedBilling
  ? new HostedUsagePolicy(hostedBillingRuntime)
  : new NoOpUsagePolicy();

// Usage is reserved at policy-check time; metering sink is a no-op for both editions.
export const meteringSink: MeteringSink = new NoOpMeteringSink();

// Create handlers using the factories
export const generateHandler = createGenerateHandler({
  auth,
  store,
  router,
  planner,
  loadExerciseLibrary,
  policy: usagePolicy,
  metering: meteringSink,
  config,
});
