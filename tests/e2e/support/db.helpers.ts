import type { APIRequestContext } from '@playwright/test';
import { PARABANK_API_PREFIX } from './parabank.constants';
import { expect2xxWithStatus, HttpStatus } from './api-assertions';

/** Resets ParaBank demo data (`cleanDB` then `initializeDB`). Required before scenarios that assume seeded `john/demo`. */
export async function resetDemoDatabase(request: APIRequestContext): Promise<void> {
  for (const path of [`${PARABANK_API_PREFIX}/cleanDB`, `${PARABANK_API_PREFIX}/initializeDB`]) {
    const r = await request.post(path);
    expect2xxWithStatus(r, HttpStatus.NO_CONTENT, path);
  }
}
