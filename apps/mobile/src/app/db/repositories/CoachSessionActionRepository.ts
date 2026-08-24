import { Q } from '@nozbe/watermelondb';
import type { Database } from '@nozbe/watermelondb';
import type {
  CoachSessionAction as CoachSessionActionContract,
  CoachScheduleStrategy,
} from '@workout-agent/shared';
import { coachSessionActionSchema } from '@workout-agent/shared';
import CoachSessionActionModel from '../models/CoachSessionAction';

type RecordSkipActionInput = Omit<
  CoachSessionActionContract,
  'id' | 'actionKind' | 'createdAt'
> & {
  createdAt?: string;
};

// Invalid rows are dropped (not thrown) so one corrupted or legacy record
// cannot break the coach actions subscription that feeds Home data.
const toContract = (
  action: CoachSessionActionModel
): CoachSessionActionContract | null => {
  const parsed = coachSessionActionSchema.safeParse({
    id: action.id,
    actionKind: action.actionKind,
    programId: action.programId,
    programVersion: action.programVersion,
    strategy: action.strategy,
    cycleIndex: action.cycleIndex,
    sessionIdentityKey: action.sessionIdentityKey,
    projectionId: action.projectionId,
    sourceBlockId: action.sourceBlockId ?? undefined,
    projectedLocalDate: action.projectedLocalDate,
    actionLocalDate: action.actionLocalDate,
    workoutId: action.workoutId ?? undefined,
    substitutionWorkoutId: action.substitutionWorkoutId ?? undefined,
    substitutionBlockId: action.substitutionBlockId ?? undefined,
    createdAt: new Date(action.createdAt).toISOString(),
  });
  if (!parsed.success) {
    console.warn(
      `Skipping invalid coach session action record ${action.id}`,
      parsed.error
    );
    return null;
  }
  return parsed.data;
};

const toContractOrThrow = (
  action: CoachSessionActionModel
): CoachSessionActionContract => {
  const contract = toContract(action);
  if (!contract) {
    throw new Error(`Invalid coach session action record ${action.id}`);
  }
  return contract;
};

const toContracts = (
  actions: CoachSessionActionModel[]
): CoachSessionActionContract[] =>
  actions
    .map(toContract)
    .filter(
      (contract): contract is CoachSessionActionContract => contract !== null
    );

export class CoachSessionActionRepository {
  private readonly actions;

  constructor(private readonly database: Database) {
    this.actions = database.collections.get<CoachSessionActionModel>(
      'coach_session_actions'
    );
  }

  toCoachSessionAction(
    action: CoachSessionActionModel
  ): CoachSessionActionContract {
    return toContractOrThrow(action);
  }

  observeActionsForProgram(programId: string) {
    const observable = this.actions
      .query(Q.where('program_id', programId), Q.sortBy('created_at', Q.asc))
      .observe();

    return {
      subscribe: (callback: (actions: CoachSessionActionContract[]) => void) =>
        observable.subscribe((actions) => callback(toContracts(actions))),
    };
  }

  async listActionsForProgram(
    programId: string
  ): Promise<CoachSessionActionContract[]> {
    const actions = await this.actions
      .query(Q.where('program_id', programId), Q.sortBy('created_at', Q.asc))
      .fetch();
    return toContracts(actions);
  }

  async recordSkipAction(
    input: RecordSkipActionInput
  ): Promise<CoachSessionActionContract> {
    const parsed = coachSessionActionSchema.parse({
      ...input,
      actionKind: 'skip',
      createdAt: input.createdAt ?? new Date().toISOString(),
    });

    const existing = await this.actions
      .query(
        Q.where('action_kind', 'skip'),
        Q.where('program_id', parsed.programId),
        Q.where('program_version', parsed.programVersion),
        Q.where('strategy', parsed.strategy),
        Q.where('cycle_index', parsed.cycleIndex),
        Q.where('session_identity_key', parsed.sessionIdentityKey)
      )
      .fetch();

    const saved = await this.database.write(async () => {
      const action = existing[0];
      if (action) {
        return await action.update((record) => {
          record.strategy = parsed.strategy as CoachScheduleStrategy;
          record.projectionId = parsed.projectionId;
          record.sourceBlockId = parsed.sourceBlockId ?? undefined;
          record.projectedLocalDate = parsed.projectedLocalDate;
          record.actionLocalDate = parsed.actionLocalDate;
          record.workoutId = parsed.workoutId ?? undefined;
          record.substitutionWorkoutId =
            parsed.substitutionWorkoutId ?? undefined;
          record.substitutionBlockId = parsed.substitutionBlockId ?? undefined;
        });
      }

      return await this.actions.create((record) => {
        record.actionKind = parsed.actionKind;
        record.programId = parsed.programId;
        record.programVersion = parsed.programVersion;
        record.strategy = parsed.strategy;
        record.cycleIndex = parsed.cycleIndex;
        record.sessionIdentityKey = parsed.sessionIdentityKey;
        record.projectionId = parsed.projectionId;
        record.sourceBlockId = parsed.sourceBlockId ?? undefined;
        record.projectedLocalDate = parsed.projectedLocalDate;
        record.actionLocalDate = parsed.actionLocalDate;
        record.workoutId = parsed.workoutId ?? undefined;
        record.substitutionWorkoutId =
          parsed.substitutionWorkoutId ?? undefined;
        record.substitutionBlockId = parsed.substitutionBlockId ?? undefined;
      });
    });

    return toContractOrThrow(saved);
  }
}
