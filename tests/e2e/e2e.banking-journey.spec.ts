/**
 * End-to-end journey matching objectives/playwright.txt.
 */
import { test } from '@playwright/test';
import { resetDemoDatabase } from './support/db.helpers';
import {
  assertBalancesAfterTransfer,
  createCheckingAccountViaCurl,
  expectDemoCustomerIdFromLoginApi,
  expectExistingAccount12345ViaApi,
  generateRegistrationUsername,
  getTransferBaselineBalances,
  logInAsDemoCustomerWithOverviewHeading,
  logOutFromOverviewViaLink,
  logoutToIndexViaLogoutHtm,
  registerNewUserViaUi,
  transferFundsViaUi,
  verifyNewAccountLinkOnOverview,
} from './support/journey-steps';

test.describe.serial('Core banking E2E', () => {
  test('full scenario from objectives/playwright.txt', async ({ page, request }) => {
    await test.step('Reset demo database', async () => {
      await resetDemoDatabase(request);
    });

    const regUsername = generateRegistrationUsername();

    await test.step('Register new user (UI)', async () => {
      await registerNewUserViaUi(page, regUsername);
    });

    await test.step('Logout after registration', async () => {
      await logoutToIndexViaLogoutHtm(page);
    });

    await test.step('Login as demo customer (UI)', async () => {
      await logInAsDemoCustomerWithOverviewHeading(page);
    });

    await test.step('Get customer ID (API)', async () => {
      await expectDemoCustomerIdFromLoginApi(request);
    });

    await test.step('Get existing account (API)', async () => {
      await expectExistingAccount12345ViaApi(request);
    });

    const newAccountId = await test.step('Create CHECKING via curl', async () => {
      return createCheckingAccountViaCurl();
    });

    await test.step('Verify new account in UI', async () => {
      await verifyNewAccountLinkOnOverview(page, newAccountId);
    });

    const transferAmount = 1;
    const baseline = await test.step('Snapshot balances before transfer (API)', async () => {
      return getTransferBaselineBalances(request);
    });

    await test.step('Transfer funds (UI)', async () => {
      await transferFundsViaUi(page, transferAmount, false);
    });

    await test.step('Validate balances after transfer (API)', async () => {
      await assertBalancesAfterTransfer(request, baseline, transferAmount);
    });

    await test.step('Logout', async () => {
      await logOutFromOverviewViaLink(page);
    });
  });
});
