import { test } from '@playwright/test';
import {
  DEMO_TRANSFER_FROM_ACCOUNT_ID,
  DEMO_TRANSFER_TO_ACCOUNT_ID,
} from './support/parabank.constants';
import { resetDemoDatabase } from './support/db.helpers';
import {
  assertBalancesAfterTransfer,
  getTransferBaselineBalances,
  postTransferApi,
} from './support/journey-steps';

test.describe('Account balances (API)', { tag: '@component' }, () => {
  test('transfer updates balances', async ({ request }) => {
    await resetDemoDatabase(request);

    const baseline = await getTransferBaselineBalances(request);

    const amount = 4.5;
    await postTransferApi(
      request,
      DEMO_TRANSFER_FROM_ACCOUNT_ID,
      DEMO_TRANSFER_TO_ACCOUNT_ID,
      amount,
    );

    await assertBalancesAfterTransfer(request, baseline, amount);
  });
});
