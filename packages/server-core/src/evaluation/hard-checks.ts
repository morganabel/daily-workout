import {
  generationEvaluationHardCheckResultSchema,
  type GenerationEvaluationHardCheckResult,
  type GenerationEvaluationScenario,
  type HardCheckName,
  type TodayPlan,
  todayPlanSchema,
} from '@workout-agent/shared';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function buildExerciseNameText(plan: TodayPlan): string {
  return plan.blocks
    .flatMap((block) => block.exercises.map((exercise) => exercise.name))
    .join(' ')
    .toLowerCase();
}

function collectExerciseNames(plan: TodayPlan): Set<string> {
  return new Set(
    plan.blocks.flatMap((block) =>
      block.exercises.map((exercise) => normalize(exercise.name)),
    ),
  );
}

function buildResult(
  name: HardCheckName,
  status: GenerationEvaluationHardCheckResult['status'],
  message?: string,
): GenerationEvaluationHardCheckResult {
  return generationEvaluationHardCheckResultSchema.parse({
    name,
    status,
    message,
  });
}

function runSchemaValidityCheck(plan: TodayPlan | undefined) {
  if (!plan) {
    return buildResult('schema-validity', 'fail', 'No plan was generated.');
  }

  const result = todayPlanSchema.safeParse(plan);
  return result.success
    ? buildResult('schema-validity', 'pass')
    : buildResult('schema-validity', 'fail', result.error.message);
}

function runDurationFitCheck(
  scenario: GenerationEvaluationScenario,
  plan: TodayPlan | undefined,
) {
  if (!plan) {
    return buildResult('duration-fit', 'not-applicable');
  }

  const target =
    scenario.request.timeMinutes ??
    scenario.context?.environment.timeAvailableMinutes;
  if (!target) {
    return buildResult('duration-fit', 'not-applicable');
  }

  const difference = Math.abs(plan.durationMinutes - target);
  return difference <= scenario.hardExpectations.durationToleranceMinutes
    ? buildResult(
        'duration-fit',
        'pass',
        `Target ${target} min, got ${plan.durationMinutes} min.`,
      )
    : buildResult(
        'duration-fit',
        'fail',
        `Target ${target} min, got ${plan.durationMinutes} min.`,
      );
}

function runFocusFitCheck(
  scenario: GenerationEvaluationScenario,
  plan: TodayPlan | undefined,
) {
  const requiredFocus = scenario.hardExpectations.requiredFocus;
  if (!plan || !requiredFocus) {
    return buildResult('focus-fit', 'not-applicable');
  }

  const matches = normalize(plan.focus).includes(normalize(requiredFocus));
  return matches
    ? buildResult('focus-fit', 'pass', `Plan focus '${plan.focus}' matches.`)
    : buildResult(
        'focus-fit',
        'fail',
        `Expected focus similar to '${requiredFocus}', got '${plan.focus}'.`,
      );
}

function runEquipmentFitCheck(
  scenario: GenerationEvaluationScenario,
  plan: TodayPlan | undefined,
) {
  if (!plan) {
    return buildResult('equipment-fit', 'not-applicable');
  }

  if (!scenario.hardExpectations.requireOnlyAvailableEquipment) {
    return buildResult('equipment-fit', 'not-applicable');
  }

  const requestedEquipment = scenario.request.equipment;
  const environmentEquipment = scenario.context?.environment.equipment;
  const effectiveEquipment =
    requestedEquipment && requestedEquipment.length > 0
      ? requestedEquipment
      : environmentEquipment && environmentEquipment.length > 0
        ? environmentEquipment
        : ['Bodyweight'];

  const allowed = new Set(effectiveEquipment.map(normalize));

  const unexpected = plan.equipment.filter(
    (item) => !allowed.has(normalize(item)),
  );
  return unexpected.length === 0
    ? buildResult('equipment-fit', 'pass')
    : buildResult(
        'equipment-fit',
        'fail',
        `Plan uses unavailable equipment: ${unexpected.join(', ')}.`,
      );
}

function runSafetyCheck(
  name: 'injury-safety' | 'avoid-list-safety',
  active: boolean,
  bannedTerms: string[],
  plan: TodayPlan | undefined,
) {
  if (!active || !plan || bannedTerms.length === 0) {
    return buildResult(name, 'not-applicable');
  }

  const exerciseText = buildExerciseNameText(plan);
  const matches = bannedTerms.filter((term) =>
    exerciseText.includes(normalize(term)),
  );
  return matches.length === 0
    ? buildResult(name, 'pass')
    : buildResult(name, 'fail', `Found banned terms: ${matches.join(', ')}.`);
}

function runUpcomingEventSensitivityCheck(
  scenario: GenerationEvaluationScenario,
  plan: TodayPlan | undefined,
) {
  if (!scenario.hardExpectations.requireUpcomingEventSensitivity || !plan) {
    return buildResult('upcoming-event-sensitivity', 'not-applicable');
  }

  const disallowedFocuses =
    scenario.hardExpectations.disallowedFocuses.map(normalize);
  const planFocus = normalize(plan.focus);
  const matched = disallowedFocuses.filter((focus) =>
    planFocus.includes(focus),
  );

  return matched.length === 0
    ? buildResult('upcoming-event-sensitivity', 'pass')
    : buildResult(
        'upcoming-event-sensitivity',
        'fail',
        `Plan focus '${plan.focus}' matched disallowed focuses: ${matched.join(', ')}.`,
      );
}

function runRegenerationDifferenceCheck(
  scenario: GenerationEvaluationScenario,
  plan: TodayPlan | undefined,
) {
  if (!scenario.hardExpectations.requireRegenerationDifference) {
    return buildResult('regeneration-difference', 'not-applicable');
  }

  if (!plan || !scenario.baselinePlan) {
    return buildResult(
      'regeneration-difference',
      'fail',
      'Missing regenerated plan or baseline plan.',
    );
  }

  const previousNames = collectExerciseNames(scenario.baselinePlan);
  const currentNames = collectExerciseNames(plan);
  const intersection = Array.from(previousNames).filter((name) =>
    currentNames.has(name),
  ).length;
  const union = new Set([...previousNames, ...currentNames]).size;
  const similarity = union === 0 ? 1 : intersection / union;
  const focusChanged =
    normalize(plan.focus) !== normalize(scenario.baselinePlan.focus);
  const durationChanged =
    Math.abs(plan.durationMinutes - scenario.baselinePlan.durationMinutes) >= 5;

  if (focusChanged || durationChanged || similarity < 0.8) {
    return buildResult(
      'regeneration-difference',
      'pass',
      `Exercise similarity ${similarity.toFixed(2)}.`,
    );
  }

  return buildResult(
    'regeneration-difference',
    'fail',
    `Exercise similarity ${similarity.toFixed(2)} looks too close to baseline.`,
  );
}

export function runHardChecksForScenario(
  scenario: GenerationEvaluationScenario,
  plan?: TodayPlan,
): GenerationEvaluationHardCheckResult[] {
  const bannedTerms = scenario.hardExpectations.bannedExerciseTerms;
  const hasInjuries = Boolean(scenario.context?.preferences.injuries?.length);
  const hasAvoidList = Boolean(scenario.context?.preferences.avoid?.length);

  return [
    runSchemaValidityCheck(plan),
    runDurationFitCheck(scenario, plan),
    runFocusFitCheck(scenario, plan),
    runEquipmentFitCheck(scenario, plan),
    runSafetyCheck('injury-safety', hasInjuries, bannedTerms, plan),
    runSafetyCheck('avoid-list-safety', hasAvoidList, bannedTerms, plan),
    runUpcomingEventSensitivityCheck(scenario, plan),
    runRegenerationDifferenceCheck(scenario, plan),
  ];
}

export function summarizeHardFailures(
  results: GenerationEvaluationHardCheckResult[],
): Record<string, number> {
  return results.reduce<Record<string, number>>((acc, result) => {
    if (result.status !== 'fail') {
      return acc;
    }

    acc[result.name] = (acc[result.name] ?? 0) + 1;
    return acc;
  }, {});
}
