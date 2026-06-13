import {
  addDaysToLocalDate,
  daysBetweenLocalDates,
  localDateToUtcOrdinal,
} from './local-date';

describe('local date calendar math', () => {
  it('counts calendar days across DST spring-forward without millisecond drift', () => {
    expect(daysBetweenLocalDates('2026-03-15', '2026-03-08')).toBe(7);
  });

  it('counts calendar days across DST fall-back without millisecond drift', () => {
    expect(daysBetweenLocalDates('2026-11-08', '2026-11-01')).toBe(7);
  });

  it('adds days using calendar-date ordinals', () => {
    expect(addDaysToLocalDate('2026-03-08', 7)).toBe('2026-03-15');
    expect(addDaysToLocalDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('rejects impossible local dates', () => {
    expect(() => localDateToUtcOrdinal('2026-02-30')).toThrow(
      'Invalid local date'
    );
  });
});
