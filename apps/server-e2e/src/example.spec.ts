import { test, expect } from '@playwright/test';

test('renders the Workout Agent CE server status page', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Workout Agent CE' })
  ).toBeVisible();
  await expect(page.getByText('GET /api/meta')).toBeVisible();
  await expect(page.getByText('POST /api/workouts/generate')).toBeVisible();
});
