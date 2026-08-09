import { expect, test } from '@playwright/test';

test('landing page renders main heading and signup action', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.getByRole('link', { name: 'Get started' }).first().click();
  await expect(page).toHaveURL(/\/login\?mode=signup$/);
  await expect(page.getByRole('textbox', { name: 'First name' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Account' })).toBeDisabled();
});

test('anonymous protected deep links return to the public entry point', async ({ page }) => {
  await page.goto('/focus');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('360px layout does not overflow horizontally', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  const sizes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
});
