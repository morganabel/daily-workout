import { migrations } from './migrations';
import { schema } from './schema';

describe('database schema migrations', () => {
  it('adds session-level coach attribution to workouts in version 9', () => {
    expect(schema.version).toBe(9);
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
});
