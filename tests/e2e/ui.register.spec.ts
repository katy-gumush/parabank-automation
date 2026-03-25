import { test } from '@playwright/test';
import { resetDemoDatabase } from './support/db.helpers';
import { generateRegistrationUsername, registerNewUserViaUi } from './support/parabank-flow.helpers';

test.describe('Register new user', () => {
  test(
    'completes registration from UI',
    { tag: '@component' },
    async ({ page, request }) => {
      await resetDemoDatabase(request);
      const username = generateRegistrationUsername();
      await registerNewUserViaUi(page, username);
    },
  );
});
