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
} from '@leveza/server-core';
import {
  DefaultModelRouter,
  DefaultStageOnePlanner,
} from '@leveza/server-ai';
import type { ExerciseLibrary } from '@leveza/server-exercise-library';
import type {
  ProviderAdmissionPolicy,
  SpendCeilingPolicy,
} from '@leveza/quotas';
import type { AiProviderName } from '@leveza/shared';
import { getAuthContext } from './auth-context';
import { getRevenueCatBillingServices } from './billing-services';
import { getBillingProvider, resolveEdition } from './deployment';

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
      '@leveza/server-exercise-library'
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

const allowedProviders = new Set<AiProviderName>([
  'openai',
  'gemini',
  'openrouter',
]);

const buildConfig = (): GenerateHandlerConfig => {
  const rawProvider = process.env.AI_PROVIDER?.toLowerCase();
  if (rawProvider && !allowedProviders.has(rawProvider as AiProviderName)) {
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
    edition: resolveEdition(),
    useVertexAi,
    googleCloudProject,
    googleCloudLocation,
    defaultApiKeys: {
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
      openrouter: process.env.OPENROUTER_API_KEY,
    },
    defaultProvider: (rawProvider as AiProviderName) ?? 'openai',
    enableStageOnePlanner: process.env.ENABLE_STAGE_ONE_PLANNER !== 'false',
  };
};

// Build server configuration from environment
const config = buildConfig();
const revenueCatBilling = getBillingProvider() === 'revenuecat';

export const usagePolicy: UsagePolicy = revenueCatBilling
  ? {
      async reserveGenerate(request) {
        const services = await getRevenueCatBillingServices();
        return services.usagePolicy.reserveGenerate(request);
      },
      async commitGenerateReservation(reservation) {
        const services = await getRevenueCatBillingServices();
        await services.usagePolicy.commitGenerateReservation(reservation);
      },
      async rollbackGenerateReservation(reservation) {
        const services = await getRevenueCatBillingServices();
        await services.usagePolicy.rollbackGenerateReservation(reservation);
      },
      async getEntitlements(accountId) {
        const services = await getRevenueCatBillingServices();
        return services.getEntitlements(accountId);
      },
    }
  : new NoOpUsagePolicy();

export const admissionPolicy: ProviderAdmissionPolicy | undefined =
  revenueCatBilling
    ? {
        async acquireProviderAdmission(input) {
          const services = await getRevenueCatBillingServices();
          return services.admissionPolicy.acquireProviderAdmission(input);
        },
        async releaseProviderAdmission(lease) {
          const services = await getRevenueCatBillingServices();
          await services.admissionPolicy.releaseProviderAdmission(lease);
        },
      }
    : undefined;

export const spendCeilingPolicy: SpendCeilingPolicy | undefined =
  revenueCatBilling
    ? {
        async checkSpendCeiling(input) {
          const services = await getRevenueCatBillingServices();
          return services.spendCeilingPolicy.checkSpendCeiling(input);
        },
      }
    : undefined;

// Hosted generation writes an idempotent operation ledger. CE remains no-op.
export const meteringSink: MeteringSink = revenueCatBilling
  ? {
      async recordUsage(event) {
        const services = await getRevenueCatBillingServices();
        await services.meteringSink.recordUsage(event);
      },
    }
  : new NoOpMeteringSink();

// The generate handler needs the auth provider, which is resolved
// asynchronously (Better Auth may open the DB connection via the Cloud SQL
// Connector). Build it lazily on the first request and cache it.
type GenerateHandler = ReturnType<typeof createGenerateHandler>;
let cachedGenerateHandler: GenerateHandler | null = null;
let generateHandlerPromise: Promise<GenerateHandler> | null = null;

const getGenerateHandler = (): Promise<GenerateHandler> => {
  if (cachedGenerateHandler) {
    return Promise.resolve(cachedGenerateHandler);
  }
  if (!generateHandlerPromise) {
    generateHandlerPromise = (async () => {
      const { provider: auth } = await getAuthContext();
      cachedGenerateHandler = createGenerateHandler({
        auth,
        store,
        router,
        planner,
        loadExerciseLibrary,
        policy: usagePolicy,
        admission: admissionPolicy,
        spendCeiling: spendCeilingPolicy,
        metering: meteringSink,
        config,
      });
      return cachedGenerateHandler;
    })().catch((error) => {
      // Allow a retry on the next request after a transient failure.
      generateHandlerPromise = null;
      throw error;
    });
  }
  return generateHandlerPromise;
};

export const generateHandler = async (request: Request): Promise<Response> => {
  const handler = await getGenerateHandler();
  return handler(request);
};
