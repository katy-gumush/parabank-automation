import { test, expect } from '@playwright/test';
import {
  DEMO_CUSTOMER_ID,
  DEMO_SEEDED_ACCOUNT_ID,
  DEMO_USER,
  NEW_ACCOUNT_TYPE_CHECKING,
  PARABANK_API_PREFIX,
  PARABANK_OPENAPI_YAML,
  firstXmlId,
} from './support/parabank.constants';
import { resetDemoDatabase } from './support/db.helpers';
import {
  expect2xxWithStatus,
  expectAccountXmlStructure,
  expectAccountsListXmlStructure,
  expectCustomerXmlStructure,
  expectHttpStatus,
  expectXmlPayload,
  HttpStatus,
} from './support/api-assertions';

test.describe('ParaBank API', { tag: '@component' }, () => {
  test.beforeAll(async ({ request }) => {
    await resetDemoDatabase(request);
  });

  test.describe('OpenAPI & docs', () => {
    test('OpenAPI spec YAML is reachable (Swagger source)', async ({ request }) => {
      const res = await request.get(PARABANK_OPENAPI_YAML);
      expect2xxWithStatus(res, HttpStatus.OK, 'GET OpenAPI YAML');
      await expect(res).toBeOK();
      const text = await res.text();
      expect(text).toMatch(/^openapi:\s*3/m);
      expect(text).toContain('The ParaBank REST API');
    });
  });

  test.describe('Login & customer', () => {
    test('demo login john/demo returns customer XML with expected id and shape', async ({
      request,
    }) => {
      const res = await request.get(`${PARABANK_API_PREFIX}/login/john/demo`);
      expect2xxWithStatus(res, HttpStatus.OK, 'GET login');
      const body = await res.text();
      expectXmlPayload(body);
      expectCustomerXmlStructure(body);
      expect(firstXmlId(body)).toBe(String(DEMO_CUSTOMER_ID));
      expect(body).toContain('<firstName>John</firstName>');
      expect(body).toContain('<lastName>Smith</lastName>');
    });

    test(`customer details for seeded demo customer (${DEMO_CUSTOMER_ID})`, async ({ request }) => {
      const res = await request.get(`${PARABANK_API_PREFIX}/customers/${DEMO_CUSTOMER_ID}`);
      expect2xxWithStatus(res, HttpStatus.OK, 'GET customer');
      const body = await res.text();
      expectXmlPayload(body);
      expectCustomerXmlStructure(body);
      expect(body).toContain('John');
      expect(body).toContain('Smith');
    });

    test.describe('errors', { tag: '@negative' }, () => {
      test('login with wrong password returns 400 and error text', async ({ request }) => {
        const res = await request.get(
          `${PARABANK_API_PREFIX}/login/${DEMO_USER.username}/not-the-demo-password`,
        );
        expectHttpStatus(res, HttpStatus.BAD_REQUEST, 'GET login (bad password)');
        expect(await res.text()).toMatch(/invalid username|password/i);
      });

      test('login with unknown username returns 400', async ({ request }) => {
        const res = await request.get(
          `${PARABANK_API_PREFIX}/login/nobodyeverregistered999/wrongpass`,
        );
        expectHttpStatus(res, HttpStatus.BAD_REQUEST, 'GET login (unknown user)');
        expect(await res.text()).toMatch(/invalid username|password/i);
      });

      test('unknown customer id returns 400', async ({ request }) => {
        const res = await request.get(`${PARABANK_API_PREFIX}/customers/999999999`);
        expectHttpStatus(res, HttpStatus.BAD_REQUEST, 'GET customer (nonexistent)');
        expect(await res.text()).toContain('Could not find customer');
      });

      test('unknown customer accounts list returns 400', async ({ request }) => {
        const res = await request.get(`${PARABANK_API_PREFIX}/customers/999999999/accounts`);
        expectHttpStatus(res, HttpStatus.BAD_REQUEST, 'GET customer accounts (nonexistent customer)');
        expect(await res.text()).toContain('Could not find customer');
      });
    });
  });

  test.describe('Accounts', () => {
    test('list customer accounts', async ({ request }) => {
      const res = await request.get(
        `${PARABANK_API_PREFIX}/customers/${DEMO_CUSTOMER_ID}/accounts`,
      );
      expect2xxWithStatus(res, HttpStatus.OK, 'GET customer accounts');
      const body = await res.text();
      expectXmlPayload(body);
      expectAccountsListXmlStructure(body);
      expect(body).toContain('<type>CHECKING</type>');
      expect(body).toContain(`<customerId>${DEMO_CUSTOMER_ID}</customerId>`);
    });

    test(`get account by id (${DEMO_SEEDED_ACCOUNT_ID})`, async ({ request }) => {
      const res = await request.get(
        `${PARABANK_API_PREFIX}/accounts/${DEMO_SEEDED_ACCOUNT_ID}`,
      );
      expect2xxWithStatus(res, HttpStatus.OK, 'GET account');
      const body = await res.text();
      expectXmlPayload(body);
      expectAccountXmlStructure(body);
      expect(body).toContain(`<id>${DEMO_SEEDED_ACCOUNT_ID}</id>`);
      expect(body).toContain('CHECKING');
      expect(body).toContain(String(DEMO_CUSTOMER_ID));
    });

    test.describe('errors', { tag: '@negative' }, () => {
      test('unknown account id returns 400', async ({ request }) => {
        const res = await request.get(`${PARABANK_API_PREFIX}/accounts/1`);
        expectHttpStatus(res, HttpStatus.BAD_REQUEST, 'GET account (nonexistent)');
        expect(await res.text()).toContain('Could not find account');
      });
    });
  });

  test.describe('Create account API', () => {
    test.describe('errors', { tag: '@negative' }, () => {
      test('invalid fromAccountId returns 400', async ({ request }) => {
        const res = await request.post(
          `${PARABANK_API_PREFIX}/createAccount?customerId=${DEMO_CUSTOMER_ID}&newAccountType=${NEW_ACCOUNT_TYPE_CHECKING}&fromAccountId=1`,
        );
        expectHttpStatus(res, HttpStatus.BAD_REQUEST, 'POST createAccount (bad funding account)');
        expect(await res.text()).toContain('Could not create new account');
      });
    });
  });

  test.describe('Transfer API', () => {
    test.describe('errors', { tag: '@negative' }, () => {
      test('between non-existent accounts returns 400', async ({ request }) => {
        const res = await request.post(
          `${PARABANK_API_PREFIX}/transfer?fromAccountId=1&toAccountId=2&amount=10`,
        );
        expectHttpStatus(res, HttpStatus.BAD_REQUEST, 'POST transfer (missing accounts)');
        expect(await res.text()).toMatch(/could not find account/i);
      });

      test('without amount returns 500 error page (HTML)', async ({ request }) => {
        const res = await request.post(
          `${PARABANK_API_PREFIX}/transfer?fromAccountId=12567&toAccountId=12456`,
        );
        expectHttpStatus(res, HttpStatus.INTERNAL_SERVER_ERROR, 'POST transfer (no amount)');
        const body = await res.text();
        expect(body).toContain('text/html');
        expect(body).toMatch(/internal error|error!/i);
      });

      test('with empty amount returns 500 error page (HTML)', async ({ request }) => {
        const res = await request.post(
          `${PARABANK_API_PREFIX}/transfer?fromAccountId=12567&toAccountId=12456&amount=`,
        );
        expectHttpStatus(res, HttpStatus.INTERNAL_SERVER_ERROR, 'POST transfer (empty amount)');
        expect(await res.text()).toMatch(/internal error|error!/i);
      });

      test('with non-numeric amount returns 404', async ({ request }) => {
        const res = await request.post(
          `${PARABANK_API_PREFIX}/transfer?fromAccountId=12567&toAccountId=12456&amount=abc`,
        );
        expectHttpStatus(res, HttpStatus.NOT_FOUND, 'POST transfer (non-numeric amount)');
      });
    });
  });
});
