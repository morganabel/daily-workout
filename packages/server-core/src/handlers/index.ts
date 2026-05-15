/**
 * Handler factories for API routes
 *
 * Each factory accepts dependencies and returns a standard Request → Response handler.
 */

export {
  createGenerateHandler,
  type GenerateHandlerDeps,
  type GenerateHandlerConfig,
} from './generate';

export {
  createLogWorkoutHandler,
  type LogWorkoutHandlerDeps,
} from './log-workout';
