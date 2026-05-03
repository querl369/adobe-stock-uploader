/**
 * Canonical API contract — single source of truth for the auth posture of
 * every API endpoint, plus the typed-client helper that calls it.
 *
 * Adding a new endpoint? Add an entry here. The contract test will fail until
 * you do, which forces the question "auth or no auth?" out loud at review
 * time. This is the audit artifact that prevents the spec-time regression
 * (server adds requireAuth, client forgets to send the JWT) from ever
 * happening silently again.
 */
export type AuthPosture =
  | 'required' // requireAuth middleware mounted; JWT mandatory
  | 'optional' // attachUserIdMiddleware; JWT used if present, anonymous OK
  | 'public'; // no auth middleware; anyone can call

export interface EndpointSpec {
  path: string;
  method: 'GET' | 'POST';
  auth: AuthPosture;
  /**
   * Name of the function in client/src/api/client.ts that calls this endpoint.
   * `null` for endpoints not exposed via the typed client (e.g., legacy or
   * called directly with `fetch` from a component).
   */
  clientHelper: string | null;
  /** Free-form note explaining anything non-obvious about the entry. */
  note?: string;
}

export const ENDPOINTS: EndpointSpec[] = [
  // Upload flow
  {
    path: '/api/upload-images',
    method: 'POST',
    auth: 'optional',
    clientHelper: 'uploadImages',
    note: 'Anonymous drop-then-signup UX preserved (b1 carve-out). Auth-aware caps when JWT present.',
  },
  {
    path: '/api/upload',
    method: 'POST',
    auth: 'required',
    clientHelper: null,
    note: 'Legacy single-file upload. Not in typed client. Spec T5 gated this to prevent CPU/disk-spam.',
  },

  // Cleanup (must stay public — Home.tsx calls it on every mount)
  {
    path: '/api/cleanup',
    method: 'POST',
    auth: 'public',
    clientHelper: 'cleanup',
    note: 'Pre-existing tech debt: wipes uploads/+images/ globally. Documented follow-up.',
  },

  // Batch processing
  {
    path: '/api/process-batch-v2',
    method: 'POST',
    auth: 'required',
    clientHelper: 'startBatchProcessing',
  },
  {
    path: '/api/process-batch',
    method: 'POST',
    auth: 'required',
    clientHelper: null,
    note: 'Legacy batch endpoint. Not in typed client.',
  },
  {
    path: '/api/process-image',
    method: 'POST',
    auth: 'required',
    clientHelper: null,
    note: 'Legacy single-image endpoint. Not in typed client.',
  },
  {
    path: '/api/batch-status/:batchId',
    method: 'GET',
    auth: 'required',
    clientHelper: 'getBatchStatus',
    note: 'Polled every 2s during processing. T18 regression: client missed JWT; fixed 2026-05-03.',
  },
  {
    path: '/api/batches',
    method: 'GET',
    auth: 'required',
    clientHelper: 'getBatches',
    note: 'History list. T18 regression: client missed JWT; fixed 2026-05-03.',
  },
  {
    path: '/api/batches/:batchId',
    method: 'GET',
    auth: 'required',
    clientHelper: null,
    note: 'Single-batch detail. Not currently consumed by typed client (used by future history-detail view).',
  },

  // CSV
  {
    path: '/api/generate-csv',
    method: 'POST',
    auth: 'required',
    clientHelper: 'persistCsvToServer',
    note: 'Ownership check on batchId added 2026-05-03 (review F4).',
  },
  {
    path: '/api/download-csv/:batchId',
    method: 'GET',
    auth: 'required',
    clientHelper: 'downloadBatchCsv',
    note: 'History.tsx also calls this directly (not via typed client).',
  },
  {
    path: '/api/export-csv',
    method: 'POST',
    auth: 'required',
    clientHelper: null,
    note: 'Deprecated. Use download-csv. Not in typed client.',
  },

  // Usage / quota
  {
    path: '/api/usage',
    method: 'GET',
    auth: 'required',
    clientHelper: 'getUsage',
  },
];

/**
 * The complete list of function names the typed client (`client/src/api/client.ts`)
 * exports as API helpers. The contract completeness test verifies that this
 * list matches the actual exports — adding/removing a helper without updating
 * here fails the test.
 *
 * ApiError is a class, not a helper, so it's excluded.
 */
export const TYPED_CLIENT_HELPERS = [
  'uploadImages',
  'startBatchProcessing',
  'getBatchStatus',
  'cleanup',
  'persistCsvToServer',
  'getBatches',
  'getUsage',
  'downloadBatchCsv',
] as const;

export type TypedClientHelper = (typeof TYPED_CLIENT_HELPERS)[number];
