import { test, expect } from '@playwright/test';
import { logInAsDemoCustomer } from './support/auth.helpers';
import { gotoTransferFundsReady, transferFundsViaUi } from './support/parabank-flow.helpers';

test.describe('Transfer funds', () => {
  test(
    'transfer money between accounts (UI)',
    { tag: '@component' },
    async ({ page }) => {
      await logInAsDemoCustomer(page);
      await transferFundsViaUi(page, '1.00', true);
    },
  );

  test(
    'empty amount does not reach Transfer Complete',
    { tag: ['@component', '@negative'] },
    async ({ page }) => {
      await gotoTransferFundsReady(page);
      await page.locator('#amount').fill('');
      await page.getByRole('button', { name: 'Transfer', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Transfer Complete!', exact: true })).toBeHidden({
        timeout: 10_000,
      });
      await expect(
        page
          .getByRole('heading', { name: 'Transfer Funds', exact: true })
          .or(page.getByRole('heading', { name: 'Error!', exact: true })),
      ).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    'negative amount does not reach Transfer Complete',
    { tag: ['@component', '@negative'] },
    async ({ page }) => {
      await gotoTransferFundsReady(page);
      await page.locator('#amount').fill('-50');
      await page.getByRole('button', { name: 'Transfer', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Transfer Complete!', exact: true })).toBeHidden({
        timeout: 10_000,
      });
      await expect(
        page
          .getByRole('heading', { name: 'Transfer Funds', exact: true })
          .or(page.getByRole('heading', { name: 'Error!', exact: true })),
      ).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    'zero amount reaches Transfer Complete (demo allows $0)',
    { tag: '@component' },
    async ({ page }) => {
      await gotoTransferFundsReady(page);
      await page.locator('#amount').fill('0');
      await page.getByRole('button', { name: 'Transfer', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: 'Transfer Complete!', exact: true }),
      ).toBeVisible({ timeout: 15_000 });
    },
  );
});
