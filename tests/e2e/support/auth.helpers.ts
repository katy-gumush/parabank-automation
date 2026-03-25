import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DEMO_USER } from './parabank.constants';

export async function logInAsDemoCustomer(page: Page): Promise<void> {
  await page.goto('/parabank/index.htm');
  await page.locator('input[name="username"]').fill(DEMO_USER.username);
  await page.locator('input[name="password"]').fill(DEMO_USER.password);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/overview\.htm/, { timeout: 15_000 });
}
