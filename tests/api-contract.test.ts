/**
 * API contract test — table-driven verification that
 * `tests/api-contract.fixture.ts` matches reality on both sides.
 *
 * What this catches that per-helper unit tests can't:
 * 1. **Silent client additions.** A new function in `client/src/api/client.ts`
 *    without a contract entry fails the completeness test.
 * 2. **Silent client deletions.** Removing a helper without updating the
 *    contract fails the completeness test.
 * 3. **Drift in helper-to-endpoint mapping.** If the helper is renamed but
 *    the contract isn't updated, the per-helper auth-header test fails.
 *
 * What this does NOT catch:
 * - Whether the SERVER actually mounts requireAuth on the declared endpoints.
 *   That's verified by the existing per-route tests (e.g.,
 *   `tests/batch.routes.test.ts` asserts 401-on-unauth for each protected
 *   route). Catching server/client drift fully would require introspecting
 *   Express's route stack, which isn't worth the brittleness here.
 */
import { describe, it, expect } from 'vitest';
import * as clientModule from '../client/src/api/client';
import { ENDPOINTS, TYPED_CLIENT_HELPERS, type EndpointSpec } from './api-contract.fixture';

describe('API contract — completeness', () => {
  it('every typed client helper has an entry in TYPED_CLIENT_HELPERS', () => {
    // Filter the module's exports to function values (helpers) and exclude
    // the ApiError class.
    const actualHelpers = Object.entries(clientModule)
      .filter(([name, value]) => typeof value === 'function' && name !== 'ApiError')
      .map(([name]) => name)
      .sort();

    const declaredHelpers = [...TYPED_CLIENT_HELPERS].sort();

    expect(actualHelpers).toEqual(declaredHelpers);
  });

  it('every TYPED_CLIENT_HELPERS entry maps to an ENDPOINTS row', () => {
    for (const helper of TYPED_CLIENT_HELPERS) {
      const endpoint = ENDPOINTS.find(e => e.clientHelper === helper);
      expect(endpoint, `helper "${helper}" has no ENDPOINTS entry`).toBeDefined();
    }
  });

  it('every ENDPOINTS clientHelper either matches a real export or is null', () => {
    for (const endpoint of ENDPOINTS) {
      if (endpoint.clientHelper === null) continue;
      expect(
        TYPED_CLIENT_HELPERS,
        `endpoint ${endpoint.method} ${endpoint.path} references unknown helper "${endpoint.clientHelper}"`
      ).toContain(endpoint.clientHelper);
    }
  });

  it('endpoint paths are unique per (method, path)', () => {
    const seen = new Set<string>();
    for (const e of ENDPOINTS) {
      const key = `${e.method} ${e.path}`;
      expect(seen.has(key), `duplicate endpoint: ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('every entry has a valid auth posture', () => {
    const valid = new Set(['required', 'optional', 'public']);
    for (const e of ENDPOINTS) {
      expect(valid.has(e.auth), `${e.method} ${e.path} has invalid auth: ${e.auth}`).toBe(true);
    }
  });
});

describe('API contract — coverage by per-helper auth tests', () => {
  // This test doesn't re-run the auth-header assertions (those live in
  // tests/client-api.test.ts). It just makes the link explicit: every
  // required-auth endpoint in the table SHOULD have a corresponding test in
  // client-api.test.ts. Failure here means the table grew but the auth-header
  // test didn't, which is exactly the silent-addition gap Option 2 addresses.
  const expectedRegressionGuards: Array<{ helper: string; auth: 'required' }> = ENDPOINTS.filter(
    (e): e is EndpointSpec & { clientHelper: string; auth: 'required' } =>
      e.auth === 'required' && e.clientHelper !== null
  ).map(e => ({ helper: e.clientHelper, auth: 'required' as const }));

  it('every protected helper is listed in the regression-guard inventory', () => {
    // Hand-maintained inventory mirrors what tests/client-api.test.ts asserts.
    // Update both files together when adding a protected helper.
    const guarded = new Set([
      'startBatchProcessing',
      'getBatchStatus',
      'getBatches',
      'getUsage',
      'persistCsvToServer',
      'downloadBatchCsv',
    ]);

    const missing = expectedRegressionGuards.filter(g => !guarded.has(g.helper)).map(g => g.helper);

    expect(
      missing,
      `protected helpers without a per-helper auth-header test: ${missing.join(', ')}. ` +
        `Add a test to tests/client-api.test.ts AND update the inventory in this file.`
    ).toEqual([]);
  });
});
