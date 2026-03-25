/**
 * Post-login URL, accessible roles, and expected copy (UI contract).
 * API login/XML: `./support/api-assertions.ts` — `api.parabank.spec.ts`.
 */
import { test, expect } from '@playwright/test';
import { DEMO_USER } from './support/parabank.constants';
import { logInAsDemoCustomerWithOverviewHeading } from './support/parabank-flow.helpers';

test.describe('Login', () => {
  test(
    'log in with demo user (UI)',
    { tag: '@component' },
    async ({ page }) => {
      await logInAsDemoCustomerWithOverviewHeading(page);
    },
  );

  test(
    'wrong password shows error and stays off overview',
    { tag: ['@component', '@negative'] },
    async ({ page }) => {
      await page.goto('/parabank/index.htm');
      await page.locator('input[name="username"]').fill(DEMO_USER.username);
      await page.locator('input[name="password"]').fill('definitely-wrong-password');
      await page.getByRole('button', { name: 'Log In' }).click();
      await expect(page).not.toHaveURL(/overview\.htm/, { timeout: 15_000 });
      await expect(page.locator('p.error')).toContainText(/could not be verified/i, {
        timeout: 15_000,
      });
    },
  );
});
