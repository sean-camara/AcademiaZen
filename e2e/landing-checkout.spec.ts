import { expect, test } from '@playwright/test';

test('landing page navbar links are clickable and navigate to section anchors', async ({ page }) => {
  await page.goto('/');

  // Verify navigation links
  const howItWorksLink = page.getByRole('link', { name: 'How It Works' }).first();
  await expect(howItWorksLink).toBeVisible();
  await howItWorksLink.click();
  await expect(page.locator('#how-it-works')).toBeVisible();

  const featuresLink = page.getByRole('link', { name: 'Features' }).first();
  await expect(featuresLink).toBeVisible();
  await featuresLink.click();
  await expect(page.locator('#workspace')).toBeVisible();

  const zenAiLink = page.getByRole('link', { name: 'Zen AI' }).first();
  await expect(zenAiLink).toBeVisible();
  await zenAiLink.click();
  await expect(page.locator('#trust')).toBeVisible();

  const faqLink = page.getByRole('link', { name: 'FAQ' }).first();
  await expect(faqLink).toBeVisible();
  await faqLink.click();
  await expect(page.locator('#faq')).toBeVisible();
});

test('landing page CTA buttons redirect to login and signup flows', async ({ page }) => {
  await page.goto('/');

  const getStartedBtn = page.getByRole('link', { name: 'Get started' }).first();
  await expect(getStartedBtn).toBeVisible();
  await getStartedBtn.click();

  await expect(page).toHaveURL(/\/login\?mode=signup$/);
});
