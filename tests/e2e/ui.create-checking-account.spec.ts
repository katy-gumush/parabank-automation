import { test } from '@playwright/test';
import { logInAsDemoCustomer } from './support/auth.helpers';
import { resetDemoDatabase } from './support/db.helpers';
import {
  createCheckingAccountViaCurl,
  verifyNewAccountLinkOnOverview,
} from './support/journey-steps';

test.describe('Create CHECKING account (curl + UI)', () => {
  test(
    'new account appears in Accounts Overview',
    { tag: '@component' },
    async ({ page, request }) => {
      await resetDemoDatabase(request);
      const accountId = createCheckingAccountViaCurl();
      await logInAsDemoCustomer(page);
      await verifyNewAccountLinkOnOverview(page, accountId);
    },
  );
});
