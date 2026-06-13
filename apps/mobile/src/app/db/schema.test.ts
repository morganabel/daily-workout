import { migrations } from './migrations';
import { schema } from './schema';

describe('database schema migrations', () => {
  it('adds session-level coach attribution to workouts in version 9', () => {
    expect(schema.version).toBe(11);
    expect(schema.tables.workouts.columns).toEqual(
      expect.objectContaining({
        coach_program_attribution_json: expect.objectContaining({
          name: 'coach_program_attribution_json',
          type: 'string',
          isOptional: true,
        }),
      })
    );
    expect(migrations.sortedMigrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toVersion: 9,
          steps: [
            expect.objectContaining({
              type: 'add_columns',
              table: 'workouts',
              columns: [
                expect.objectContaining({
                  name: 'coach_program_attribution_json',
                  type: 'string',
                  isOptional: true,
                }),
              ],
            }),
          ],
        }),
      ])
    );
  });

  it('adds coach session actions in version 10', () => {
    expect(schema.tables.coach_session_actions.columns).toEqual(
      expect.objectContaining({
        action_kind: expect.objectContaining({ type: 'string' }),
        program_id: expect.objectContaining({
          type: 'string',
          isIndexed: true,
        }),
        program_version: expect.objectContaining({ type: 'number' }),
        strategy: expect.objectContaining({ type: 'string' }),
        cycle_index: expect.objectContaining({ type: 'number' }),
        session_identity_key: expect.objectContaining({
          type: 'string',
          isIndexed: true,
        }),
        projection_id: expect.objectContaining({ type: 'string' }),
        source_block_id: expect.objectContaining({
          type: 'string',
          isOptional: true,
        }),
        projected_local_date: expect.objectContaining({
          type: 'string',
          isIndexed: true,
        }),
        action_local_date: expect.objectContaining({ type: 'string' }),
        workout_id: expect.objectContaining({
          type: 'string',
          isOptional: true,
        }),
        substitution_workout_id: expect.objectContaining({
          type: 'string',
          isOptional: true,
        }),
        substitution_block_id: expect.objectContaining({
          type: 'string',
          isOptional: true,
        }),
      })
    );
    expect(migrations.sortedMigrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toVersion: 10,
          steps: [
            expect.objectContaining({
              type: 'create_table',
              schema: expect.objectContaining({
                name: 'coach_session_actions',
              }),
            }),
          ],
        }),
      ])
    );
  });

  it('adds an indexed coach projection id to workouts in version 11', () => {
    expect(schema.tables.workouts.columns).toEqual(
      expect.objectContaining({
        coach_projection_id: expect.objectContaining({
          name: 'coach_projection_id',
          type: 'string',
          isOptional: true,
          isIndexed: true,
        }),
      })
    );
    expect(migrations.sortedMigrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toVersion: 11,
          steps: [
            expect.objectContaining({
              type: 'add_columns',
              table: 'workouts',
              columns: [
                expect.objectContaining({
                  name: 'coach_projection_id',
                  type: 'string',
                  isOptional: true,
                  isIndexed: true,
                }),
              ],
            }),
          ],
        }),
      ])
    );
  });
});
