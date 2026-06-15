import type { ExperienceLevel, UserPreferences } from '@workout-agent/shared';

export type EditorKey =
  | 'profile'
  | 'rhythm'
  | 'constraints'
  | 'equipment'
  | 'generation';

export type PreferenceUpdater = <K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K]
) => void;

export const EXPERIENCE_LEVELS: {
  value: ExperienceLevel;
  label: string;
  description: string;
}[] = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'New to fitness or returning after a long break',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: '1-3 years of consistent training',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: '3+ years with solid technique',
  },
];

export const EDITOR_TITLES: Record<EditorKey, string> = {
  profile: 'Coach profile',
  rhythm: 'Training plan',
  constraints: 'Safety & constraints',
  equipment: 'Equipment',
  generation: 'Workout creation',
};

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  beginner: 'Beginner lifter',
  intermediate: 'Intermediate lifter',
  advanced: 'Advanced lifter',
};
