import { expect, test } from '@playwright/test';

test('landing page has a working keyboard skip link and signup action', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /enter your study world/i })).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();

  await page.getByRole('link', { name: 'Create your study space' }).first().click();
  await expect(page).toHaveURL(/\/login\?mode=signup$/);
  await expect(page.getByRole('textbox', { name: 'First name' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Account' })).toBeDisabled();
});

test('anonymous protected deep links return to the public entry point', async ({ page }) => {
  await page.goto('/focus');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: /enter your study world/i })).toBeVisible();
});

test('360px layout does not overflow horizontally', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  const sizes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
  await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Sign in' }))
    .toHaveCSS('white-space', 'nowrap');
});

test('reduced-motion preference suppresses nonessential transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const transitionSeconds = await page.locator('summary span').first().evaluate((element) => (
    Number.parseFloat(getComputedStyle(element).transitionDuration)
  ));
  expect(transitionSeconds).toBeLessThanOrEqual(0.001);
});

test('a previously loaded production shell reloads while offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => navigator.serviceWorker?.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller))).toBe(true);
  await expect.poll(() => page.evaluate(async () => {
    const cache = await caches.open('zen-static-v11');
    const requests = await cache.keys();
    return requests.some((request) => /\/assets\/Landing-.*\.js$/.test(new URL(request.url).pathname));
  })).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: /enter your study world/i })).toBeVisible();

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: /enter your study world/i })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
