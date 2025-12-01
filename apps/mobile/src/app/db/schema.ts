import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 3,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        { name: 'preferences', type: 'string', isOptional: true }, // JSON string
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'workouts',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'status', type: 'string' }, // 'planned', 'completed', 'skipped'
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'focus', type: 'string', isOptional: true },
        { name: 'summary', type: 'string', isOptional: true },
        { name: 'energy', type: 'string', isOptional: true },
        { name: 'source', type: 'string', isOptional: true },
        { name: 'equipment_json', type: 'string', isOptional: true },
        { name: 'plan_json', type: 'string', isOptional: true },
        { name: 'scheduled_date', type: 'number', isOptional: true },
        { name: 'completed_at', type: 'number', isOptional: true },
        { name: 'duration_seconds', type: 'number', isOptional: true },
        { name: 'archived_at', type: 'number', isOptional: true },
        // OpenAI response ID for conversation context when regenerating
        { name: 'response_id', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'exercises',
      columns: [
        { name: 'workout_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'muscle_group', type: 'string', isOptional: true },
        { name: 'order', type: 'number' },
        { name: 'block_id', type: 'string', isOptional: true },
        { name: 'block_title', type: 'string', isOptional: true },
        { name: 'block_focus', type: 'string', isOptional: true },
        { name: 'block_duration', type: 'number', isOptional: true },
        { name: 'block_order', type: 'number', isOptional: true },
        { name: 'prescription', type: 'string', isOptional: true },
        { name: 'detail', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'sets',
      columns: [
        { name: 'exercise_id', type: 'string', isIndexed: true },
        { name: 'reps', type: 'number', isOptional: true },
        { name: 'weight', type: 'number', isOptional: true },
        { name: 'rpe', type: 'number', isOptional: true },
        { name: 'completed', type: 'boolean' },
        { name: 'order', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
