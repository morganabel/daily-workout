/**
 * Next.js instrumentation hook. `register()` runs once when the server process
 * starts.
 *
 * Validates configuration at boot so a misconfigured hosted deployment exits
 * immediately, rather than starting up and only erroring once traffic arrives.
 * A non-zero exit lets the surrounding runtime surface the failure.
 */

export async function register(): Promise<void> {
  // Only the Node.js server runtime needs the boot check.
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { validateBootConfig } = await import('./lib/boot-config');

  try {
    validateBootConfig();
  } catch (error) {
    console.error(
      '[boot] invalid configuration; refusing to start:',
      error instanceof Error ? error.message : error
    );
    // Exit non-zero so the process fails fast on misconfiguration.
    process.exit(1);
  }
}
