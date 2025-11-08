// TODO: move these shared types into packages/shared when the API contract stabilizes.
export type TodayPlan = {
  id: string;
  focus: string;
  durationMinutes: number;
  equipment: string[];
  source: 'ai' | 'manual';
  energy: 'easy' | 'moderate' | 'intense';
};

export type WorkoutSessionSummary = {
  id: string;
  name: string;
  completedAt: string;
  durationMinutes: number;
  focus: string;
};

export type QuickActionKey =
  | 'time'
  | 'focus'
  | 'equipment'
  | 'energy'
  | 'backfill';

export type QuickActionMetadata = {
  key: QuickActionKey;
  label: string;
  description: string;
};

