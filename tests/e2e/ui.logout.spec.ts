import { test } from '@playwright/test';
import { logInAsDemoCustomer } from './support/auth.helpers';
import {
  assertWelcomeBannerCleared,
  logOutViaLinkExpectLoginUi,
} from './support/journey-steps';

test.describe('Logout', () => {
  test(
    'log out ends session (UI)',
    { tag: '@component' },
    async ({ page }) => {
      await logInAsDemoCustomer(page);
      await logOutViaLinkExpectLoginUi(page);
      await assertWelcomeBannerCleared(page);
    },
  );
});
