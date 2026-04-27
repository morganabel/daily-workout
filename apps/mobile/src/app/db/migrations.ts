import {
  schemaMigrations,
  addColumns,
  createTable,
} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'workouts',
          columns: [{ name: 'response_id', type: 'string', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'workouts',
          columns: [{ name: 'archived_at', type: 'number', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: 'workouts',
          columns: [{ name: 'is_favorite', type: 'boolean', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: 'sets',
          columns: [{ name: 'weight_unit', type: 'string', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 6,
      steps: [
        createTable({
          name: 'planned_events',
          columns: [
            { name: 'kind', type: 'string' },
            { name: 'title', type: 'string' },
            { name: 'local_date', type: 'string', isIndexed: true },
            { name: 'created_at_timezone', type: 'string' },
            { name: 'starts_at', type: 'number', isOptional: true },
            { name: 'ends_at', type: 'number', isOptional: true },
            { name: 'all_day', type: 'boolean', isOptional: true },
            { name: 'duration_minutes', type: 'number', isOptional: true },
            { name: 'intensity', type: 'string', isOptional: true },
            { name: 'tags_json', type: 'string', isOptional: true },
            { name: 'notes', type: 'string', isOptional: true },
            { name: 'status', type: 'string', isOptional: true },
            { name: 'linked_workout_id', type: 'string', isOptional: true },
            { name: 'details_json', type: 'string', isOptional: true },
            { name: 'metadata_json', type: 'string', isOptional: true },
            { name: 'archived_at', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      toVersion: 7,
      steps: [
        addColumns({
          table: 'workouts',
          columns: [
            { name: 'generation_group_id', type: 'string', isOptional: true },
            { name: 'generation_version', type: 'number', isOptional: true },
            { name: 'is_selected', type: 'boolean', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
