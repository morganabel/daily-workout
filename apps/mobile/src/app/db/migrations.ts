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
  ],
});

