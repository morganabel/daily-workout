import type {
  CandidateDiagnostics,
  CandidateResult,
  ExerciseLibraryMetadata,
} from '@workout-agent-ce/server-exercise-library';
import { openExerciseLibrary } from '@workout-agent-ce/server-exercise-library';
import { buildBrowserQueryState } from './query';
import styles from './page.module.css';

export const metadata = {
  title: 'Exercise Library Browser',
  description: 'Temporary internal browser for the exercise library.',
};

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ExerciseLibraryBrowserPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const state = buildBrowserQueryState(resolvedSearchParams);

  let metadata: ExerciseLibraryMetadata | null = null;
  let result: CandidateResult | null = null;
  let errorMessage: string | null = null;

  try {
    const library = openExerciseLibrary();

    try {
      metadata = library.getLibraryMetadata();
      result = state.variationMode
        ? library.listVariationCandidates(state.query)
        : library.listEligibleExercises(state.query);
    } finally {
      library.close();
    }
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to open exercise library';
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.eyebrow}>Internal Tool</div>
          <h1 className={styles.title}>Exercise Library Browser</h1>
          <p className={styles.subtitle}>
            Search the real SQLite-backed exercise library using the same query
            engine the planner uses. This route is intentionally isolated so it
            can be removed later by deleting `tools/exercise-library/`.
          </p>
          <p className={styles.note}>
            Variation mode turns on automatically when `baselineExerciseIds` are
            supplied.
          </p>
        </header>

        <div className={styles.layout}>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Search</h2>
            <form className={styles.form} method="get">
              <div className={styles.field}>
                <label htmlFor="searchText">Search text</label>
                <input
                  defaultValue={state.formValues.searchText}
                  id="searchText"
                  name="searchText"
                  placeholder="rowing machine cardio"
                  type="text"
                />
                <div className={styles.hint}>
                  Full-text ranking. Equipment, focus, style, notes, injuries,
                  and avoid terms are also folded into the final search text.
                </div>
              </div>

              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label htmlFor="equipment">Equipment</label>
                  <input
                    defaultValue={state.formValues.equipment}
                    id="equipment"
                    name="equipment"
                    placeholder="Bodyweight, Pull-up Bar"
                    type="text"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="focusTags">Focus tags</label>
                  <input
                    defaultValue={state.formValues.focusTags}
                    id="focusTags"
                    name="focusTags"
                    placeholder="upper body, core"
                    type="text"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="injuries">Injuries / contraindications</label>
                  <input
                    defaultValue={state.formValues.injuries}
                    id="injuries"
                    name="injuries"
                    placeholder="shoulder, knee"
                    type="text"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="avoidTags">Avoid</label>
                  <input
                    defaultValue={state.formValues.avoidTags}
                    id="avoidTags"
                    name="avoidTags"
                    placeholder="jumping, overhead"
                    type="text"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="styleBias">Style bias</label>
                  <input
                    defaultValue={state.formValues.styleBias}
                    id="styleBias"
                    name="styleBias"
                    placeholder="strength, cardio"
                    type="text"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="baselineExerciseIds">
                    Baseline exercise IDs
                  </label>
                  <input
                    defaultValue={state.formValues.baselineExerciseIds}
                    id="baselineExerciseIds"
                    name="baselineExerciseIds"
                    placeholder="fedb:pullups"
                    type="text"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="experienceLevel">Experience level</label>
                  <select
                    defaultValue={state.formValues.experienceLevel}
                    id="experienceLevel"
                    name="experienceLevel"
                  >
                    <option value="">Any</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label htmlFor="minimumMetadataCompleteness">
                    Minimum completeness
                  </label>
                  <select
                    defaultValue={state.formValues.minimumMetadataCompleteness}
                    id="minimumMetadataCompleteness"
                    name="minimumMetadataCompleteness"
                  >
                    <option value="raw">raw</option>
                    <option value="derived">derived</option>
                    <option value="curated">curated</option>
                    <option value="planner-ready">planner-ready</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label htmlFor="loadCeiling">Load ceiling</label>
                  <select
                    defaultValue={state.formValues.loadCeiling}
                    id="loadCeiling"
                    name="loadCeiling"
                  >
                    <option value="">Any</option>
                    <option value="light">light</option>
                    <option value="moderate">moderate</option>
                    <option value="heavy">heavy</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label htmlFor="blockRole">Role</label>
                  <select
                    defaultValue={state.formValues.blockRole}
                    id="blockRole"
                    name="blockRole"
                  >
                    <option value="">Any</option>
                    <option value="warmup">warmup</option>
                    <option value="main">main</option>
                    <option value="accessory">accessory</option>
                    <option value="finisher">finisher</option>
                    <option value="recovery">recovery</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label htmlFor="limit">Limit</label>
                  <input
                    defaultValue={state.formValues.limit}
                    id="limit"
                    max="200"
                    min="1"
                    name="limit"
                    step="1"
                    type="number"
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="notes">Notes / environment text</label>
                <textarea
                  defaultValue={state.formValues.notes}
                  id="notes"
                  name="notes"
                  placeholder="quiet apartment, no jumping, travel, no floor"
                />
                <div className={styles.hint}>
                  Notes trigger the same useful heuristics as the app: quiet,
                  low impact / no jumping, travel / hotel, and no floor /
                  standing only.
                </div>
              </div>

              <div className={styles.actions}>
                <button className={styles.button} type="submit">
                  Run search
                </button>
                <a
                  className={styles.secondaryButton}
                  href="/tools/exercise-library"
                >
                  Reset
                </a>
              </div>
            </form>
          </section>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Results</h2>

            {errorMessage ? (
              <div className={styles.warning}>{errorMessage}</div>
            ) : null}

            {metadata ? (
              <div className={styles.summaryGrid}>
                <article className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>Library version</div>
                  <div className={styles.summaryValue}>
                    {metadata.libraryVersion}
                  </div>
                </article>
                <article className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>Total exercises</div>
                  <div className={styles.summaryValue}>
                    {metadata.exerciseCount}
                  </div>
                </article>
                <article className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>Planner-ready</div>
                  <div className={styles.summaryValue}>
                    {metadata.plannerReadyCount}
                  </div>
                </article>
                <article className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>Returned / eligible</div>
                  <div className={styles.summaryValue}>
                    {result?.exercises.length ?? 0}/
                    {result?.totalEligibleCount ?? 0}
                  </div>
                </article>
              </div>
            ) : null}

            {result?.diagnostics ? (
              <div className={styles.warning}>
                <strong>No exact matches.</strong>
                <ul className={styles.diagnosticsList}>
                  {formatDiagnostics(result.diagnostics).map((diagnostic) => (
                    <li className={styles.chip} key={diagnostic}>
                      {diagnostic}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className={styles.queryBlock}>
              <strong>
                {state.variationMode
                  ? 'listVariationCandidates'
                  : 'listEligibleExercises'}
              </strong>
              <pre>{JSON.stringify(state.query, null, 2)}</pre>
            </div>

            {result && result.exercises.length > 0 ? (
              <div className={styles.resultsList}>
                {result.exercises.map((exercise) => (
                  <article className={styles.resultCard} key={exercise.id}>
                    <header className={styles.resultHeader}>
                      <div>
                        <h3 className={styles.resultTitle}>{exercise.name}</h3>
                        <p className={styles.resultSubtitle}>
                          {exercise.id} • {exercise.slug}
                        </p>
                      </div>
                      <div className={styles.metaList}>
                        <span className={styles.chip}>
                          {exercise.metadataCompleteness}
                        </span>
                        <span className={styles.chip}>
                          {exercise.loadLevel}
                        </span>
                        <span className={styles.chip}>
                          {exercise.experienceLevelMin}
                        </span>
                      </div>
                    </header>

                    <p className={styles.description}>{exercise.description}</p>

                    <div className={styles.metaGrid}>
                      <TagSection
                        title="Required equipment"
                        values={exercise.requiredEquipment}
                      />
                      <TagSection
                        title="Optional equipment"
                        values={exercise.optionalEquipment}
                      />
                      <TagSection title="Focus" values={exercise.focusTags} />
                      <TagSection
                        title="Movement"
                        values={exercise.movementTags}
                      />
                      <TagSection title="Style" values={exercise.styleTags} />
                      <TagSection
                        title="Stressors"
                        values={exercise.stressorTags}
                      />
                      <TagSection
                        title="Contraindications"
                        values={exercise.contraindicationTags}
                      />
                      <TagSection
                        title="Avoid tags"
                        values={exercise.avoidTags}
                      />
                      <TagSection
                        title="Roles"
                        values={exercise.allowedRoles}
                      />
                      <TagSection title="Aliases" values={exercise.aliases} />
                    </div>

                    <div className={styles.metaGrid}>
                      <section className={styles.metaSection}>
                        <h3>Environment</h3>
                        <ul className={styles.tagList}>
                          <li className={styles.chip}>
                            impact: {exercise.impactLevel}
                          </li>
                          <li className={styles.chip}>
                            noise: {exercise.noiseLevel}
                          </li>
                          <li className={styles.chip}>
                            space: {exercise.spaceFootprint}
                          </li>
                          <li className={styles.chip}>
                            travel: {exercise.travelFriendly ? 'yes' : 'no'}
                          </li>
                          <li className={styles.chip}>
                            floor:{' '}
                            {exercise.floorRequired
                              ? 'required'
                              : 'not required'}
                          </li>
                        </ul>
                      </section>

                      <section className={styles.metaSection}>
                        <h3>Instructions</h3>
                        {exercise.instructionSteps.length ? (
                          <ol className={styles.steps}>
                            {exercise.instructionSteps.map((step, index) => (
                              <li key={`${exercise.id}-step-${index + 1}`}>
                                {step}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <div className={styles.empty}>No instructions.</div>
                        )}
                      </section>
                    </div>

                    <details>
                      <summary>
                        Source refs ({exercise.sourceRefs.length})
                      </summary>
                      {exercise.sourceRefs.length ? (
                        <ul className={styles.sourceRefList}>
                          {exercise.sourceRefs.map((sourceRef) =>
                            // Older library builds may omit sourceUrl from the exported type surface.
                            // Keep the browser compatible with either shape while preserving the value when present.
                            (() => {
                              const sourceUrl =
                                'sourceUrl' in sourceRef &&
                                typeof sourceRef.sourceUrl === 'string'
                                  ? sourceRef.sourceUrl
                                  : undefined;

                              return (
                                <li
                                  key={`${exercise.id}-${sourceRef.source}-${sourceRef.sourceId}`}
                                >
                                  <strong>{sourceRef.source}</strong>
                                  <div>{sourceRef.sourceId}</div>
                                  <div>{sourceRef.sourceVersion}</div>
                                  {sourceUrl ? <div>{sourceUrl}</div> : null}
                                </li>
                              );
                            })(),
                          )}
                        </ul>
                      ) : (
                        <div className={styles.empty}>
                          No source refs retained on this record.
                        </div>
                      )}
                    </details>
                  </article>
                ))}
              </div>
            ) : null}

            {!errorMessage && result && result.exercises.length === 0 ? (
              <div className={styles.empty}>
                No exercises returned for this query.
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function TagSection({ title, values }: { title: string; values: string[] }) {
  return (
    <section className={styles.metaSection}>
      <h3>{title}</h3>
      {values.length ? (
        <ul className={styles.tagList}>
          {values.map((value) => (
            <li className={styles.chip} key={`${title}-${value}`}>
              {value}
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>None</div>
      )}
    </section>
  );
}

function formatDiagnostics(diagnostics: CandidateDiagnostics): string[] {
  const items = diagnostics.blockerCodes.map((blockerCode) => {
    const countKey = mapDiagnosticCountKey(blockerCode);
    const count = countKey ? diagnostics.counts?.[countKey] : undefined;
    return count ? `${blockerCode}: ${count}` : blockerCode;
  });

  return items;
}

function mapDiagnosticCountKey(
  blockerCode: CandidateDiagnostics['blockerCodes'][number],
): keyof NonNullable<CandidateDiagnostics['counts']> | undefined {
  switch (blockerCode) {
    case 'unsupported_equipment':
      return 'relaxedEquipment';
    case 'focus_gap':
      return 'relaxedFocus';
    case 'role_gap':
      return 'relaxedRole';
    case 'stressor_conflict':
      return 'relaxedStressors';
    case 'planner_ready_gap':
      return 'lowerCompleteness';
    default:
      return undefined;
  }
}
