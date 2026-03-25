import { expect, type APIResponse } from '@playwright/test';

import { accountRowsFromAccountsXml, parseParabankXml } from './parabank.constants';


export const HttpStatus = {
  OK: 200,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export function expect2xxWithStatus(res: APIResponse, expectedStatus: number, label: string): void {
  expect(res.status(), `${label}: expected HTTP ${expectedStatus}, got ${res.status()}`).toBe(
    expectedStatus,
  );
}

/** Assert exact status for error-path API checks (e.g. ParaBank returns 400 + plain text for bad login). */
export function expectHttpStatus(res: APIResponse, expectedStatus: number, label: string): void {
  expect(res.status(), `${label}: expected HTTP ${expectedStatus}, got ${res.status()}`).toBe(
    expectedStatus,
  );
}

function expectObjectRoot(value: unknown, label: string): Record<string, unknown> {
  expect(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    `${label}: expected a single XML document object root`,
  ).toBeTruthy();
  return value as Record<string, unknown>;
}

/** Parsed API body is XML with a known top-level element (`customer`, `accounts`, or `account`). */
export function expectXmlPayload(body: string): void {
  const root = expectObjectRoot(parseParabankXml(body), 'XML payload');
  const hasKnownRoot =
    root.customer !== undefined || root.accounts !== undefined || root.account !== undefined;
  expect(hasKnownRoot, 'XML root should be <customer>, <accounts>, or <account>').toBeTruthy();
}

function parsedCustomerRecord(body: string): Record<string, unknown> {
  const root = expectObjectRoot(parseParabankXml(body), 'customer XML');
  const customer = root.customer;
  expect(customer !== null && typeof customer === 'object' && !Array.isArray(customer)).toBeTruthy();
  return customer as Record<string, unknown>;
}

export function expectCustomerXmlStructure(body: string): void {
  const c = parsedCustomerRecord(body);
  expect(/^\d+$/.test(String(c.id)), 'customer should have numeric <id>').toBeTruthy();
}

/** Asserts `<firstName>` / `<lastName>` match demo profile (parsed, not substring). */
export function expectCustomerXmlHasNames(body: string, firstName: string, lastName: string): void {
  const c = parsedCustomerRecord(body);
  expect(String(c.firstName), 'firstName').toBe(firstName);
  expect(String(c.lastName), 'lastName').toBe(lastName);
}

export function expectAccountsListXmlStructure(body: string): void {
  const root = expectObjectRoot(parseParabankXml(body), 'accounts list XML');
  const accounts = root.accounts;
  expect(
    accounts !== null && typeof accounts === 'object' && !Array.isArray(accounts),
    'expected <accounts> element',
  ).toBeTruthy();
  const wrap = accounts as Record<string, unknown>;
  const raw = wrap.account;
  expect(raw !== undefined, 'expected <account> under <accounts>').toBeTruthy();
  const rows = Array.isArray(raw) ? raw : [raw];
  expect(rows.length > 0, 'expected at least one account row').toBeTruthy();
  expect(
    rows.every((row) => row !== null && typeof row === 'object' && !Array.isArray(row)),
    'each <account> row should be an object',
  ).toBeTruthy();
}

/** At least one CHECKING row and one row for the given `customerId` (ParaBank demo list). */
export function expectAccountsListXmlHasCheckingAndCustomer(
  body: string,
  customerId: number | string,
): void {
  const rows = accountRowsFromAccountsXml(body);
  expect(rows.length > 0, 'expected account rows').toBeTruthy();
  const idStr = String(customerId);
  expect(
    rows.some((r) => String(r.customerId) === idStr),
    `expected an account with customerId ${idStr}`,
  ).toBeTruthy();
  expect(
    rows.some((r) => String(r.type).toUpperCase() === 'CHECKING'),
    'expected a CHECKING account in list',
  ).toBeTruthy();
}

function parsedSingleAccount(body: string): Record<string, unknown> {
  const root = expectObjectRoot(parseParabankXml(body), 'account XML');
  const account = root.account;
  expect(
    account !== null && typeof account === 'object' && !Array.isArray(account),
    'expected <account> element',
  ).toBeTruthy();
  return account as Record<string, unknown>;
}

function assertAccountShape(a: Record<string, unknown>): void {
  expect(/^\d+$/.test(String(a.id)), 'account should have numeric <id>').toBeTruthy();
  const bal = Number.parseFloat(String(a.balance));
  expect(!Number.isNaN(bal), 'account should have numeric <balance>').toBeTruthy();
}

export function expectAccountXmlStructure(body: string): void {
  assertAccountShape(parsedSingleAccount(body));
}

/** Single-account XML matches seeded demo CHECKING account id and owner. */
export function expectAccountXmlMatchesSeededChecking(
  body: string,
  accountId: number | string,
  customerId: number | string,
): void {
  const a = parsedSingleAccount(body);
  assertAccountShape(a);
  expect(String(a.id), 'account id').toBe(String(accountId));
  expect(String(a.type).toUpperCase(), 'account type').toBe('CHECKING');
  expect(String(a.customerId), 'customerId').toBe(String(customerId));
}

/** Response body from `POST /createAccount` with `newAccountType=0` (CHECKING). */
export function expectCreateAccountXmlIsChecking(body: string): void {
  const a = parsedSingleAccount(body);
  assertAccountShape(a);
  expect(String(a.type).toUpperCase(), 'new account should be CHECKING').toBe('CHECKING');
}

/** Plain-text success body from `POST /transfer`. */
export function expectTransferSuccessMessage(body: string): void {
  expect(body).toMatch(/Successfully transferred/i);
  expect(body).toMatch(/from account/i);
  expect(body).toMatch(/to account/i);
}
