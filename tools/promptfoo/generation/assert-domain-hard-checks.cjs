function parseOutput(output) {
  if (typeof output === 'string') {
    return JSON.parse(output);
  }
  return output;
}

module.exports = function assertDomainHardChecks(output) {
  let parsed;
  try {
    parsed = parseOutput(output);
  } catch (error) {
    return {
      pass: false,
      score: 0,
      reason: `Could not parse workout-generation provider output: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      pass: false,
      score: 0,
      reason: 'Workout-generation provider output was empty or invalid.',
    };
  }

  if (parsed.status !== 'success') {
    return {
      pass: false,
      score: 0,
      reason: parsed.errorMessage ?? `Generation failed with status ${parsed.status}.`,
    };
  }

  const failedHardChecks = Array.isArray(parsed.failedHardChecks)
    ? parsed.failedHardChecks
    : [];

  if (failedHardChecks.length > 0) {
    return {
      pass: false,
      score: 0,
      reason: `Failed hard checks: ${failedHardChecks
        .map((check) => check.name)
        .join(', ')}.`,
    };
  }

  return {
    pass: true,
    score: 1,
    reason: 'Generation succeeded and all domain hard checks passed.',
  };
};
