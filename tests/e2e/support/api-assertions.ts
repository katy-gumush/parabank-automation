import { expect, type APIResponse } from '@playwright/test';

/**
 * Shared expectations for ParaBank API tests: HTTP status, XML envelope/entity shape, transfer payloads.
 *
 * Layers this supports:
 * - **Status** — explicit codes per endpoint (`expect2xxWithStatus`, `expectHttpStatus`).
 * - **Structure** — XML roots and fields consistent with the OpenAPI-backed service.
 * - **Transfer** — plain-text success body patterns after `POST /transfer`.
 *
 * UI-focused checks stay in spec files and `journey-steps.ts`; see `objectives/assertion-strategy.md`.
 */

/** Readable HTTP status codes for specs (avoid magic numbers next to `expectHttpStatus`). */
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

export function expectXmlPayload(body: string): void {
  expect(
    body.includes('<?xml') || body.includes('<accounts>') || body.includes('<customer>'),
    'body should look like XML (declaration or known root)',
  ).toBeTruthy();
}

export function expectCustomerXmlStructure(body: string): void {
  expect(body).toContain('<customer>');
  expect(body).toContain('</customer>');
  expect(body).toMatch(/<id>\d+<\/id>/);
}

export function expectAccountsListXmlStructure(body: string): void {
  expect(body).toContain('<accounts>');
  expect(body).toContain('</accounts>');
  expect(body).toMatch(/<account>/);
}

export function expectAccountXmlStructure(body: string): void {
  expect(body).toContain('<account>');
  expect(body).toContain('</account>');
  expect(body).toMatch(/<id>\d+<\/id>/);
  expect(body).toMatch(/<balance>[-\d.]+<\/balance>/);
}

/** Plain-text success body from `POST /transfer`. */
export function expectTransferSuccessMessage(body: string): void {
  expect(body).toMatch(/Successfully transferred/i);
  expect(body).toMatch(/from account/i);
  expect(body).toMatch(/to account/i);
}
