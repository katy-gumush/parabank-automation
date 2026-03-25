import { execSync } from 'node:child_process';
import { randomInt } from 'crypto';
import { expect } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { logInAsDemoCustomer } from './auth.helpers';
import {
  DEMO_CUSTOMER_ID,
  DEMO_FUNDING_ACCOUNT_ID,
  DEMO_SEEDED_ACCOUNT_ID,
  DEMO_TRANSFER_FROM_ACCOUNT_ID,
  DEMO_TRANSFER_TO_ACCOUNT_ID,
  NEW_ACCOUNT_TYPE_CHECKING,
  PARABANK_API_PREFIX,
  PARABANK_ORIGIN,
  balancesByAccountIdFromAccountsXml,
  firstXmlId,
} from './parabank.constants';
import {
  expect2xxWithStatus,
  expectAccountXmlMatchesSeededChecking,
  expectAccountsListXmlStructure,
  expectCreateAccountXmlIsChecking,
  expectCustomerXmlStructure,
  expectTransferSuccessMessage,
  expectXmlPayload,
  HttpStatus,
} from './api-assertions';

export function randomSsnDigits(): string {
  const n = randomInt(0, 1_000_000_000);
  const s = String(n).padStart(9, '0');
  return `${s.slice(0, 3)}-${s.slice(3, 5)}-${s.slice(5)}`;
}

export function generateRegistrationUsername(): string {
  return `reg${Date.now()}${randomInt(1000, 9999)}`;
}

/** Fills the register form, submits, and asserts success (UI + copy). Returns the username. */
export async function registerNewUserViaUi(page: Page, username: string): Promise<void> {
  const form = page.locator('#customerForm');
  await page.goto('/parabank/register.htm', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Signing up is easy!' })).toBeVisible();

  await form.locator('input[name="customer.firstName"]').fill('Play');
  await form.locator('input[name="customer.lastName"]').fill('Wright');
  await form.locator('input[name="customer.address.street"]').fill('123 Main Street');
  await form.locator('input[name="customer.address.city"]').fill('Boston');
  await form.locator('input[name="customer.address.state"]').fill('MA');
  await form.locator('input[name="customer.address.zipCode"]').fill('02101');
  await form.locator('input[name="customer.phoneNumber"]').fill('555-341-4444');
  await form.locator('input[name="customer.ssn"]').fill(randomSsnDigits());
  await form.locator('input[name="customer.username"]').fill(username);
  await form.locator('input[name="customer.password"]').fill('pass123', { force: true });
  await form.locator('input[name="repeatedPassword"]').fill('pass123', { force: true });
  await expect(form.locator('input[name="customer.password"]')).toHaveValue('pass123');
  await expect(form.locator('input[name="repeatedPassword"]')).toHaveValue('pass123');
  await form.getByRole('button', { name: 'Register' }).click();

  await expect(
    page.getByRole('heading', { name: `Welcome ${username}`, exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveTitle(/Customer Created/i);
  await expect(
    page
      .getByRole('paragraph')
      .filter({ hasText: /Your account was created successfully/i }),
  ).toBeVisible();
}

export async function logoutToIndexViaLogoutHtm(page: Page): Promise<void> {
  await page.goto('/parabank/logout.htm');
  await expect(page).toHaveURL(/index\.htm/, { timeout: 15_000 });
}

export async function logInAsDemoCustomerWithOverviewHeading(page: Page): Promise<void> {
  await logInAsDemoCustomer(page);
  await expect(
    page.getByRole('heading', { name: 'Accounts Overview', exact: true }),
  ).toBeVisible();
}

/**
 * Transfer Funds page: logged in as demo user, from/to accounts selected (no amount submit).
 * Shared by amount edge-case UI tests.
 */
export async function gotoTransferFundsReady(page: Page): Promise<void> {
  await logInAsDemoCustomer(page);
  const accountsLoaded = page.waitForResponse(
    (r) =>
      r.url().includes(`/customers/${DEMO_CUSTOMER_ID}/accounts`) &&
      r.request().method() === 'GET' &&
      r.ok(),
  );
  await page.goto('/parabank/transfer.htm');
  await expect(
    page.getByRole('heading', { name: 'Transfer Funds', exact: true }),
  ).toBeVisible();
  await accountsLoaded;

  const fromSelect = page.locator('#fromAccountId');
  await expect
    .poll(async () => fromSelect.locator('option').count(), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(2);
  await fromSelect.selectOption(DEMO_TRANSFER_FROM_ACCOUNT_ID);
  await page.locator('#toAccountId').selectOption(DEMO_TRANSFER_TO_ACCOUNT_ID);
}

/** GET `/login/john/demo` — status, XML shape, customer id. */
export async function expectDemoCustomerIdFromLoginApi(request: APIRequestContext): Promise<void> {
  const res = await request.get(`${PARABANK_API_PREFIX}/login/john/demo`);
  expect2xxWithStatus(res, HttpStatus.OK, 'GET login/john/demo');
  const body = await res.text();
  expectXmlPayload(body);
  expectCustomerXmlStructure(body);
  expect(firstXmlId(body)).toBe(String(DEMO_CUSTOMER_ID));
}

/** GET `/accounts/{DEMO_SEEDED_ACCOUNT_ID}` — seeded CHECKING account after `initializeDB`. */
export async function expectExistingAccount12345ViaApi(request: APIRequestContext): Promise<void> {
  const res = await request.get(`${PARABANK_API_PREFIX}/accounts/${DEMO_SEEDED_ACCOUNT_ID}`);
  expect2xxWithStatus(res, HttpStatus.OK, `GET accounts/${DEMO_SEEDED_ACCOUNT_ID}`);
  const body = await res.text();
  expectXmlPayload(body);
  expectAccountXmlMatchesSeededChecking(body, DEMO_SEEDED_ACCOUNT_ID, DEMO_CUSTOMER_ID);
}

/** POST createAccount via curl (homework requirement). Returns new account id. */
export function createCheckingAccountViaCurl(): string {
  const createUrl = `${PARABANK_ORIGIN}${PARABANK_API_PREFIX}/createAccount?customerId=${DEMO_CUSTOMER_ID}&newAccountType=${NEW_ACCOUNT_TYPE_CHECKING}&fromAccountId=${DEMO_FUNDING_ACCOUNT_ID}`;
  const createXml = execSync(`curl -sS -X POST ${JSON.stringify(createUrl)}`, {
    encoding: 'utf-8',
  });
  try {
    expectCreateAccountXmlIsChecking(createXml);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(
      `createAccount(fromAccountId=${DEMO_FUNDING_ACCOUNT_ID}) expected CHECKING XML (${reason}); snippet: ${createXml.slice(0, 500)}`,
      { cause: e },
    );
  }
  return firstXmlId(createXml);
}

/** Accounts Overview shows a link for the new account id. */
export async function verifyNewAccountLinkOnOverview(page: Page, newAccountId: string): Promise<void> {
  await page.goto('/parabank/overview.htm');
  await expect(
    page.getByRole('heading', { name: 'Accounts Overview', exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('link', { name: newAccountId, exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

export type TransferBaseline = { fromBefore: number; toBefore: number };

export async function getTransferBaselineBalances(request: APIRequestContext): Promise<TransferBaseline> {
  const res = await request.get(
    `${PARABANK_API_PREFIX}/customers/${DEMO_CUSTOMER_ID}/accounts`,
  );
  expect2xxWithStatus(res, HttpStatus.OK, 'GET customer accounts (before transfer)');
  const body = await res.text();
  expectXmlPayload(body);
  expectAccountsListXmlStructure(body);
  const balances = balancesByAccountIdFromAccountsXml(body);
  const fromBefore = balances.get(DEMO_TRANSFER_FROM_ACCOUNT_ID);
  const toBefore = balances.get(DEMO_TRANSFER_TO_ACCOUNT_ID);
  expect(fromBefore, 'from account balance').toBeDefined();
  expect(toBefore, 'to account balance').toBeDefined();
  return { fromBefore: fromBefore!, toBefore: toBefore! };
}

/**
 * UI transfer flow: waits for account options, submits transfer, asserts completion heading.
 * @param assertResultPanel — also assert `#showResult` mentions both account ids (component test bar).
 */
export async function transferFundsViaUi(
  page: Page,
  transferAmount: number | string,
  assertResultPanel?: boolean,
): Promise<void> {
  const accountsLoaded = page.waitForResponse(
    (r) =>
      r.url().includes(`/customers/${DEMO_CUSTOMER_ID}/accounts`) &&
      r.request().method() === 'GET' &&
      r.ok(),
  );
  await page.goto('/parabank/transfer.htm');
  await expect(
    page.getByRole('heading', { name: 'Transfer Funds', exact: true }),
  ).toBeVisible();
  await accountsLoaded;

  const fromSelect = page.locator('#fromAccountId');
  const toSelect = page.locator('#toAccountId');
  await expect(fromSelect).toBeVisible();
  await expect
    .poll(async () => fromSelect.locator('option').count(), {
      timeout: 15_000,
    })
    .toBeGreaterThanOrEqual(2);

  await fromSelect.selectOption(DEMO_TRANSFER_FROM_ACCOUNT_ID);
  await toSelect.selectOption(DEMO_TRANSFER_TO_ACCOUNT_ID);
  await page.locator('#amount').fill(String(transferAmount));
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();

  await expect(
    page.getByRole('heading', { name: 'Transfer Complete!', exact: true }),
  ).toBeVisible({ timeout: 15_000 });

  if (assertResultPanel) {
    await expect(page.locator('#showResult')).toContainText(DEMO_TRANSFER_FROM_ACCOUNT_ID);
    await expect(page.locator('#showResult')).toContainText(DEMO_TRANSFER_TO_ACCOUNT_ID);
  }
}

export async function postTransferApi(
  request: APIRequestContext,
  fromAccountId: string,
  toAccountId: string,
  amount: number,
): Promise<void> {
  const res = await request.post(
    `${PARABANK_API_PREFIX}/transfer?fromAccountId=${fromAccountId}&toAccountId=${toAccountId}&amount=${amount}`,
  );
  expect2xxWithStatus(res, HttpStatus.OK, 'POST transfer');
  expectTransferSuccessMessage(await res.text());
}

export async function assertBalancesAfterTransfer(
  request: APIRequestContext,
  baseline: TransferBaseline,
  transferAmount: number,
): Promise<void> {
  const res = await request.get(
    `${PARABANK_API_PREFIX}/customers/${DEMO_CUSTOMER_ID}/accounts`,
  );
  expect2xxWithStatus(res, HttpStatus.OK, 'GET customer accounts (after transfer)');
  const body = await res.text();
  expectXmlPayload(body);
  expectAccountsListXmlStructure(body);
  const balances = balancesByAccountIdFromAccountsXml(body);
  expect(balances.get(DEMO_TRANSFER_FROM_ACCOUNT_ID)).toBeCloseTo(
    baseline.fromBefore - transferAmount,
    2,
  );
  expect(balances.get(DEMO_TRANSFER_TO_ACCOUNT_ID)).toBeCloseTo(
    baseline.toBefore + transferAmount,
    2,
  );
}

export async function logOutFromOverviewViaLink(page: Page): Promise<void> {
  await page.goto('/parabank/overview.htm');
  await page.getByRole('link', { name: 'Log Out' }).click();
  await expect(page).toHaveURL(/index\.htm/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Customer Login' })).toBeVisible();
}

/** When already on a page that shows Log Out (e.g. overview after login). */
export async function logOutViaLinkExpectLoginUi(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Log Out' }).click();
  await expect(page).toHaveURL(/index\.htm/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Customer Login' })).toBeVisible();
}

export async function assertWelcomeBannerCleared(page: Page): Promise<void> {
  await expect(page.getByText(/Welcome John Smith/i)).toHaveCount(0);
}
