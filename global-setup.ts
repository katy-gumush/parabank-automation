import { request } from '@playwright/test';

/**
 * Resets ParaBank demo data so UI/API tests see a known seed (see Swagger POST /initializeDB).
 */
export default async function globalSetup(): Promise<void> {
  const context = await request.newContext({
    baseURL: 'https://parabank.parasoft.com',
  });
  try {
    let res = await context.post('/parabank/services/bank/cleanDB');
    if (!res.ok()) {
      throw new Error(`cleanDB failed: HTTP ${res.status()}`);
    }
    res = await context.post('/parabank/services/bank/initializeDB');
    if (!res.ok()) {
      throw new Error(`initializeDB failed: HTTP ${res.status()}`);
    }
  } finally {
    await context.dispose();
  }
}
