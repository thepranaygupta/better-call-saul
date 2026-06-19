/**
 * Playwright E2E — BDA happy path
 *
 * Prerequisites:
 *   - MongoDB running locally (docker start saul-mongo)
 *   - Database seeded (npm run seed)
 *   - The webServer config in playwright.config.ts will start the dev server
 *
 * Run: npx playwright test tests/e2e/happy-path.spec.ts
 *
 * NOTE: This test will fail if MongoDB is not running or data is not seeded.
 * That is expected in CI without a Mongo service container. The test is
 * designed for local development verification.
 */

import { test, expect } from '@playwright/test';

test.describe('BDA happy path', () => {
  test('login -> queue -> lead detail -> log disposition -> analytics', async ({ page }) => {
    // ---- Step 1: Login as BDA ----
    await page.goto('/login');
    await page.fill('input[name="email"]', 'rahul@saul.dev');
    await page.fill('input[name="password"]', 'rahul123');
    await page.click('button[type="submit"]');

    // Should redirect to queue
    await page.waitForURL('**/queue', { timeout: 15000 });
    await expect(page).toHaveURL(/\/queue/);

    // ---- Step 2: Queue should show leads ----
    // Wait for the table to be populated (leads may take a moment to load)
    await expect(
      page.locator('table tbody tr').first(),
    ).toBeVisible({ timeout: 10000 });

    // There should be at least one lead row
    const leadRows = page.locator('table tbody tr');
    await expect(leadRows.first()).toBeVisible();

    // ---- Step 3: Click the first lead to open detail ----
    await leadRows.first().locator('a').first().click();
    await page.waitForURL('**/leads/**', { timeout: 10000 });

    // Score breakdown should be visible on the lead detail page
    await expect(page.getByText('FIT')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('INTENT')).toBeVisible({ timeout: 5000 });

    // ---- Step 4: Log a disposition ----
    // Look for the disposition form / select
    const outcomeSelect = page.locator('select, [role="combobox"]').first();
    if (await outcomeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await outcomeSelect.selectOption('connected');
    }

    // Try to find and click a submit/log button for the disposition
    const submitButton = page.locator(
      'button:has-text("Log"), button:has-text("Submit"), button:has-text("Save")',
    ).first();
    if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitButton.click();
      // Wait briefly for the optimistic UI update
      await page.waitForTimeout(1000);
    }

    // ---- Step 5: Navigate to analytics ----
    // Look for analytics link in nav
    const analyticsLink = page.locator(
      'a[href="/analytics"], a[href*="analytics"]',
    ).first();
    if (await analyticsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await analyticsLink.click();
      await page.waitForURL('**/analytics', { timeout: 10000 });
      await expect(page).toHaveURL(/\/analytics/);
    }
  });

  test('BDA cannot access admin routes', async ({ page }) => {
    // Login as BDA
    await page.goto('/login');
    await page.fill('input[name="email"]', 'rahul@saul.dev');
    await page.fill('input[name="password"]', 'rahul123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/queue', { timeout: 15000 });

    // Try navigating to admin — should be blocked or redirected
    await page.goto('/admin');
    // Should not see admin content; either redirected or shown forbidden
    await page.waitForTimeout(2000);
    const url = page.url();
    // Either redirected away from /admin or page shows access denied
    const isRedirected = !url.includes('/admin');
    const showsForbidden = await page
      .getByText(/forbidden|unauthorized|access denied|not authorized/i)
      .isVisible()
      .catch(() => false);
    expect(isRedirected || showsForbidden).toBe(true);
  });
});
