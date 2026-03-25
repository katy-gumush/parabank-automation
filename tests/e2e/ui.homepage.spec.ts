import { test, expect } from '@playwright/test';

const welcomePath = '/parabank';

test.describe('Home / welcome', () => {
  test('has ParaBank title', { tag: '@component' }, async ({ page }) => {
    await page.goto(welcomePath);
    await expect(page).toHaveTitle(/ParaBank/i);
  });

  test('shows customer login panel', { tag: '@component' }, async ({ page }) => {
    await page.goto(welcomePath);
    await expect(
      page.getByRole('heading', { name: 'Customer Login' }),
    ).toBeVisible();
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });
});
