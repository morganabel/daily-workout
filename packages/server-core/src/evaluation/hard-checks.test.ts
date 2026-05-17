import { workoutGenerationEvaluationScenarios } from '@workout-agent/shared';
import { createTodayPlanFixture } from '@workout-agent/shared/testing';

import { runHardChecksForScenario, summarizeHardFailures } from './hard-checks';

describe('runHardChecksForScenario', () => {
  it('passes a straightforward beginner scenario', () => {
    const scenario = workoutGenerationEvaluationScenarios.find(
      (item) => item.id === 'beginner-bodyweight-easy-15'
    );

    expect(scenario).toBeDefined();

    const plan = createTodayPlanFixture({
      focus: 'Full Body',
      durationMinutes: 15,
      equipment: ['Bodyweight'],
    });

    const results = runHardChecksForScenario(scenario!, plan);

    expect(
      results.find((item) => item.name === 'schema-validity')?.status
    ).toBe('pass');
    expect(results.find((item) => item.name === 'duration-fit')?.status).toBe(
      'pass'
    );
    expect(results.find((item) => item.name === 'equipment-fit')?.status).toBe(
      'pass'
    );
  });

  it('fails equipment-fit when unavailable equipment appears in the plan', () => {
    const scenario = workoutGenerationEvaluationScenarios.find(
      (item) => item.id === 'beginner-bodyweight-easy-15'
    );

    const plan = createTodayPlanFixture({
      focus: 'Full Body',
      durationMinutes: 15,
      equipment: ['Barbell'],
    });

    const results = runHardChecksForScenario(scenario!, plan);

    expect(results.find((item) => item.name === 'equipment-fit')?.status).toBe(
      'fail'
    );
  });

  it('passes equipment-fit for implicit accessories and normalized band aliases', () => {
    const scenario = workoutGenerationEvaluationScenarios.find(
      (item) => item.id === 'pre-race-run-taper'
    );

    const plan = createTodayPlanFixture({
      focus: 'Mobility & Recovery',
      durationMinutes: 25,
      equipment: ['Mat', 'Resistance Band'],
    });

    const results = runHardChecksForScenario(scenario!, plan);

    expect(results.find((item) => item.name === 'equipment-fit')?.status).toBe(
      'pass'
    );
  });

  it('passes equipment-fit for wall in indoor settings', () => {
    const scenario = workoutGenerationEvaluationScenarios.find(
      (item) => item.id === 'notes-quiet-apartment'
    );

    const plan = createTodayPlanFixture({
      focus: 'Mobility & Recovery',
      durationMinutes: 20,
      equipment: ['Wall'],
    });

    const results = runHardChecksForScenario(scenario!, plan);

    expect(results.find((item) => item.name === 'equipment-fit')?.status).toBe(
      'pass'
    );
  });

  it('fails equipment-fit for wall in outdoor settings', () => {
    const outdoorScenario = workoutGenerationEvaluationScenarios.find(
      (item) => item.id === 'beach-vacation-band-and-towel-35'
    );

    expect(outdoorScenario).toBeDefined();

    const plan = createTodayPlanFixture({
      focus: 'Mobility & Recovery',
      durationMinutes: 25,
      equipment: ['Wall'],
    });

    const results = runHardChecksForScenario(outdoorScenario!, plan);

    expect(results.find((item) => item.name === 'equipment-fit')?.status).toBe(
      'fail'
    );
  });

  it('fails injury-safety when banned exercise terms are present', () => {
    const scenario = workoutGenerationEvaluationScenarios.find(
      (item) => item.id === 'shoulder-constraint-bodyweight'
    );

    const plan = createTodayPlanFixture({
      focus: 'Full Body',
      durationMinutes: 25,
      equipment: ['Bodyweight'],
      blocks: [
        {
          id: 'block-a',
          title: 'Strength',
          durationMinutes: 12,
          focus: 'Upper Body',
          exercises: [
            {
              id: 'ex-a',
              name: 'Single-Arm Overhead Press',
              prescription: '3 x 8',
              detail: 'Slow and controlled.',
            },
          ],
        },
      ],
    });

    const results = runHardChecksForScenario(scenario!, plan);

    expect(results.find((item) => item.name === 'injury-safety')?.status).toBe(
      'fail'
    );
  });

  it('does not fail avoid-list safety when a banned term appears only in the summary', () => {
    const scenario = workoutGenerationEvaluationScenarios.find(
      (item) => item.id === 'avoid-burpees-conditioning'
    );

    const plan = createTodayPlanFixture({
      focus: 'Conditioning',
      durationMinutes: 20,
      equipment: ['Bodyweight'],
      summary: 'A conditioning workout that avoids burpees entirely.',
      blocks: [
        {
          id: 'block-a',
          title: 'Main Circuit',
          durationMinutes: 12,
          focus: 'Conditioning',
          exercises: [
            {
              id: 'ex-a',
              name: 'Mountain Climbers',
              prescription: '4 x 30 seconds',
              detail: 'Steady pace.',
            },
          ],
        },
      ],
    });

    const results = runHardChecksForScenario(scenario!, plan);

    expect(
      results.find((item) => item.name === 'avoid-list-safety')?.status
    ).toBe('pass');
  });

  it('fails upcoming-event sensitivity when focus matches a disallowed focus', () => {
    const scenario = workoutGenerationEvaluationScenarios.find(
      (item) => item.id === 'pre-race-run-taper'
    );

    const plan = createTodayPlanFixture({
      focus: 'Lower Body Power',
      durationMinutes: 25,
      equipment: ['Bodyweight', 'Resistance Bands'],
    });

    const results = runHardChecksForScenario(scenario!, plan);

    expect(
      results.find((item) => item.name === 'upcoming-event-sensitivity')?.status
    ).toBe('fail');
  });

  it('passes regeneration-difference when the plan materially changes', () => {
    const scenario = workoutGenerationEvaluationScenarios.find(
      (item) => item.id === 'regen-focus-change-auto-to-lower'
    );

    const plan = createTodayPlanFixture({
      focus: 'Lower Body',
      durationMinutes: 40,
      equipment: ['Dumbbells', 'Bench'],
      blocks: [
        {
          id: 'block-a',
          title: 'Lower Body Strength',
          durationMinutes: 20,
          focus: 'Squat pattern',
          exercises: [
            {
              id: 'ex-a',
              name: 'Goblet Squat',
              prescription: '3 x 10',
              detail: 'Controlled tempo',
            },
          ],
        },
      ],
    });

    const results = runHardChecksForScenario(scenario!, plan);

    expect(
      results.find((item) => item.name === 'regeneration-difference')?.status
    ).toBe('pass');
  });
});

describe('summarizeHardFailures', () => {
  it('aggregates failing hard checks by name', () => {
    const summary = summarizeHardFailures([
      { name: 'duration-fit', status: 'fail' },
      { name: 'duration-fit', status: 'fail' },
      { name: 'equipment-fit', status: 'fail' },
      { name: 'schema-validity', status: 'pass' },
    ]);

    expect(summary).toEqual({
      'duration-fit': 2,
      'equipment-fit': 1,
    });
  });
});
