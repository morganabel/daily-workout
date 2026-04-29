import { redactDebugNotesFields } from './redaction';

describe('debug redaction', () => {
  it('redacts nested notes-like fields without changing other values', () => {
    expect(
      redactDebugNotesFields({
        notes: 'private request note',
        focus: 'Smart',
        upcomingEvents: [
          {
            title: 'Run',
            notes: 'private event note',
            details: { coachNote: 'private detail note', intensity: 'moderate' },
          },
        ],
      }),
    ).toEqual({
      notes: '[REDACTED]',
      focus: 'Smart',
      upcomingEvents: [
        {
          title: 'Run',
          notes: '[REDACTED]',
          details: { coachNote: '[REDACTED]', intensity: 'moderate' },
        },
      ],
    });
  });
});
