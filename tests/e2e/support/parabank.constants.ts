/**
 * ParaBank — Swagger UI, OpenAPI spec, and REST path prefix (see playwright.config.ts baseURL).
 */
import { XMLParser } from 'fast-xml-parser';

export const PARABANK_SWAGGER_UI =
  'https://parabank.parasoft.com/parabank/api-docs/index.html';

export const PARABANK_OPENAPI_YAML =
  'https://parabank.parasoft.com/parabank/services/bank/openapi.yaml';

/** REST base path under the site (see Swagger “Servers”). */
export const PARABANK_API_PREFIX = '/parabank/services/bank';

/** Same origin as playwright.config.ts baseURL (for curl / absolute URLs). */
export const PARABANK_ORIGIN = 'https://parabank.parasoft.com';

/** Seeded demo user (see Swagger GET /login/{username}/{password}). */
export const DEMO_USER = {
  username: 'john',
  password: 'demo',
} as const;

/** Customer id for `john` after a fresh `initializeDB`. */
export const DEMO_CUSTOMER_ID = 12212;

/**
 * One of `john`'s seeded CHECKING accounts after `initializeDB` (GET `/accounts/{id}` in docs/samples).
 * Distinct from funding/transfer account ids below — used to assert "get account by id" on known XML.
 */
export const DEMO_SEEDED_ACCOUNT_ID = 12345;

/**
 * Account to fund `POST /createAccount` (healthy CHECKING balance after `initializeDB`).
 * Use a higher-balance id than ~$10 account 12456: parallel or repeated creates can drain a small funding account on the shared demo.
 * CHECKING maps to `newAccountType=0` in the REST API.
 */
export const DEMO_FUNDING_ACCOUNT_ID = 13122;

/**
 * Distinct seeded accounts with balance for UI transfer tests (`/transfer.htm`).
 * Values are option ids in #fromAccountId / #toAccountId after AJAX load.
 */
export const DEMO_TRANSFER_FROM_ACCOUNT_ID = '12567';
export const DEMO_TRANSFER_TO_ACCOUNT_ID = '12456';

export const NEW_ACCOUNT_TYPE_CHECKING = 0;

const parabankXmlParser = new XMLParser({
  ignoreAttributes: true,
  trimValues: true,
  parseTagValue: true,
});

function deepFirstId(node: unknown): string | undefined {
  if (node === null || node === undefined) {
    return undefined;
  }
  if (typeof node !== 'object') {
    return undefined;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = deepFirstId(item);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }
  const o = node as Record<string, unknown>;
  if ('id' in o && o.id != null && String(o.id) !== '') {
    return String(o.id);
  }
  for (const key of Object.keys(o)) {
    const found = deepFirstId(o[key]);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/** First `id` in document order (login/customer XML, single `account` from `createAccount`, etc.). */
export function firstXmlId(xml: string): string {
  let parsed: unknown;
  try {
    parsed = parabankXmlParser.parse(xml);
  } catch {
    throw new Error('Invalid XML');
  }
  const id = deepFirstId(parsed);
  if (id === undefined) {
    throw new Error('No <id> found in XML');
  }
  return id;
}

type AccountRow = Record<string, unknown>;

function accountRowsFromParsed(root: unknown): AccountRow[] {
  if (root === null || typeof root !== 'object') {
    return [];
  }
  const doc = root as Record<string, unknown>;
  const accounts = doc.accounts;
  if (accounts === null || typeof accounts !== 'object') {
    return [];
  }
  const acc = (accounts as Record<string, unknown>).account;
  if (acc === undefined) {
    return [];
  }
  return Array.isArray(acc) ? (acc as AccountRow[]) : [acc as AccountRow];
}

/** Parses account list from `GET /customers/{id}/accounts` XML into id → balance. */
export function balancesByAccountIdFromAccountsXml(xml: string): Map<string, number> {
  const map = new Map<string, number>();
  let parsed: unknown;
  try {
    parsed = parabankXmlParser.parse(xml);
  } catch (e) {
    throw new Error(
      `Failed to parse accounts XML: ${e instanceof Error ? e.message : String(e)}`,
      { cause: e },
    );
  }
  for (const row of accountRowsFromParsed(parsed)) {
    if (row.id === undefined || row.balance === undefined) {
      continue;
    }
    map.set(String(row.id), Number.parseFloat(String(row.balance)));
  }
  return map;
}
