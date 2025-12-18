import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'workouts',
          columns: [
            { name: 'response_id', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'workouts',
          columns: [
            { name: 'archived_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: 'sets',
          columns: [
            { name: 'weight_unit', type: 'string', isOptional: true },
          ],
        }),
        addColumns({
          table: 'workouts',
          columns: [
            { name: 'sync_pending', type: 'boolean', isOptional: true },
            { name: 'started_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
  ],
});

