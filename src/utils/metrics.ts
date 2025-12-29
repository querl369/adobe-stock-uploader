/**
 * Prometheus Metrics Collection
 *
 * This module sets up Prometheus metrics for monitoring application performance,
 * processing statistics, and OpenAI API costs. Metrics are exposed via /metrics endpoint
 * for Prometheus scraping.
 *
 * Metrics Collected:
 * - Default Node.js metrics (CPU, memory, event loop)
 * - Custom application metrics (processing, costs, performance)
 */

import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';
import { logger } from './logger';

/**
 * Prometheus metrics registry
 * Singleton instance that holds all metrics
 */
export const register = new Registry();

/**
 * Enable default Node.js metrics collection
 * Includes: CPU usage, memory usage, event loop lag, GC stats
 */
collectDefaultMetrics({
  register,
  prefix: 'asu_nodejs_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5], // GC duration buckets in seconds
});

/**
 * Custom Metrics
 * ===============
 */

/**
 * Counter: Total images processed
 * Labels:
 * - status: 'success' | 'failure'
 *
 * Use to track:
 * - Overall processing volume
 * - Success vs failure rates
 * - System reliability
 */
export const imagesProcessedTotal = new Counter({
  name: 'asu_images_processed_total',
  help: 'Total number of images processed',
  labelNames: ['status'] as const,
  registers: [register],
});

/**
 * Histogram: Processing duration
 * Labels:
 * - stage: 'temp_url' | 'openai' | 'csv_export' | 'total'
 *
 * Use to track:
 * - Processing performance by stage
 * - Identify bottlenecks
 * - Monitor SLA compliance
 *
 * Buckets: Configured for 0.1s to 60s processing times
 */
export const processingDurationSeconds = new Histogram({
  name: 'asu_processing_duration_seconds',
  help: 'Duration of image processing operations in seconds',
  labelNames: ['stage'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60], // Processing time buckets in seconds
  registers: [register],
});

/**
 * Counter: OpenAI API cost tracking
 *
 * Use to track:
 * - Cumulative API costs
 * - Cost per image
 * - Budget monitoring
 *
 * Cost model (as of 2024):
 * - gpt-5-mini vision: ~$0.002 per image
 */
export const openaiCostUsd = new Counter({
  name: 'asu_openai_cost_usd',
  help: 'Cumulative OpenAI API costs in USD',
  registers: [register],
});

/**
 * Counter: OpenAI API calls
 * Labels:
 * - status: 'success' | 'failure' | 'retry'
 *
 * Use to track:
 * - API reliability
 * - Retry patterns
 * - Rate limit issues
 */
export const openaiCallsTotal = new Counter({
  name: 'asu_openai_calls_total',
  help: 'Total number of OpenAI API calls',
  labelNames: ['status'] as const,
  registers: [register],
});

/**
 * Counter: Metadata validation failures
 * Labels:
 * - field: 'title' | 'keywords' | 'category'
 * - error_code: ValidationErrorCode enum value
 *
 * Story 3.4: Metadata Validation & Quality Checks (AC6)
 * Use to track:
 * - Validation failure patterns
 * - AI prompt optimization needs
 * - Quality monitoring
 */
export const metadataValidationFailuresTotal = new Counter({
  name: 'asu_metadata_validation_failures_total',
  help: 'Total metadata validation failures by field and error code',
  labelNames: ['field', 'error_code'] as const,
  registers: [register],
});

/**
 * Story 3.5: Error Recovery & Retry Logic (AC8)
 * Enhanced retry metrics for detailed error tracking
 */

/**
 * Counter: Retry attempts by error type and outcome
 * Labels:
 * - error_type: OpenAIErrorType enum value
 * - outcome: 'success' | 'failure'
 *
 * Use to track:
 * - Retry patterns by error type
 * - Success rate of retries
 */
export const retryAttemptsTotal = new Counter({
  name: 'asu_retry_attempts_total',
  help: 'Total retry attempts by error type and outcome',
  labelNames: ['error_type', 'outcome'] as const,
  registers: [register],
});

/**
 * Counter: Successful operations after at least one retry
 * Labels:
 * - error_type: The error type that triggered the initial retry
 *
 * Use to track:
 * - Recovery success rate
 * - Which error types are recoverable
 */
export const retrySuccessTotal = new Counter({
  name: 'asu_retry_success_total',
  help: 'Total successful operations after at least one retry',
  labelNames: ['error_type'] as const,
  registers: [register],
});

/**
 * Counter: Operations where all retries were exhausted
 * Labels:
 * - error_type: The error type that caused exhaustion
 *
 * Use to track:
 * - Persistent failure patterns
 * - Error types that need attention
 */
export const retryExhaustedTotal = new Counter({
  name: 'asu_retry_exhausted_total',
  help: 'Total operations where all retries were exhausted',
  labelNames: ['error_type'] as const,
  registers: [register],
});

/**
 * Metric Helper Functions
 * ========================
 */

/**
 * Records successful image processing
 * @param durationSeconds - Total processing time
 */
export function recordImageSuccess(durationSeconds: number): void {
  imagesProcessedTotal.inc({ status: 'success' });
  processingDurationSeconds.observe({ stage: 'total' }, durationSeconds);
  logger.debug({ durationSeconds }, 'Recorded successful image processing');
}

/**
 * Records failed image processing
 * @param stage - Stage where failure occurred
 */
export function recordImageFailure(stage: string): void {
  imagesProcessedTotal.inc({ status: 'failure' });
  logger.debug({ stage }, 'Recorded failed image processing');
}

/**
 * Records OpenAI API call duration and cost
 * @param durationSeconds - API call duration
 * @param cost - API call cost in USD (default: $0.002 per call)
 */
export function recordOpenAICall(durationSeconds: number, cost: number = 0.002): void {
  openaiCallsTotal.inc({ status: 'success' });
  processingDurationSeconds.observe({ stage: 'openai' }, durationSeconds);
  openaiCostUsd.inc(cost);
  logger.debug({ durationSeconds, cost }, 'Recorded OpenAI API call');
}

/**
 * Records failed OpenAI API call
 * @param isRetry - Whether this was a retry attempt
 */
export function recordOpenAIFailure(isRetry: boolean = false): void {
  openaiCallsTotal.inc({ status: isRetry ? 'retry' : 'failure' });
  logger.debug({ isRetry }, 'Recorded failed OpenAI API call');
}

/**
 * Records temp URL creation duration
 * @param durationSeconds - Duration to create temp URL
 */
export function recordTempUrlCreation(durationSeconds: number): void {
  processingDurationSeconds.observe({ stage: 'temp_url' }, durationSeconds);
  logger.debug({ durationSeconds }, 'Recorded temp URL creation');
}

/**
 * Records CSV export duration
 * @param durationSeconds - Duration to export CSV
 * @param imageCount - Number of images in CSV
 */
export function recordCsvExport(durationSeconds: number, imageCount: number): void {
  processingDurationSeconds.observe({ stage: 'csv_export' }, durationSeconds);
  logger.debug({ durationSeconds, imageCount }, 'Recorded CSV export');
}

/**
 * Records metadata validation failure
 * Story 3.4: Metadata Validation & Quality Checks (AC6)
 *
 * @param field - Field that failed validation ('title' | 'keywords' | 'category')
 * @param errorCode - Validation error code for categorization
 */
export function recordMetadataValidationFailure(field: string, errorCode: string): void {
  metadataValidationFailuresTotal.inc({ field, error_code: errorCode });
  logger.debug({ field, errorCode }, 'Recorded metadata validation failure');
}

/**
 * Story 3.5: Enhanced Retry Metrics (AC8)
 */

/**
 * Records a retry attempt with error type and outcome
 *
 * @param errorType - The classified error type (from OpenAIErrorType)
 * @param outcome - 'success' if retry succeeded, 'failure' if it failed
 */
export function recordRetryAttempt(errorType: string, outcome: 'success' | 'failure'): void {
  retryAttemptsTotal.inc({ error_type: errorType, outcome });
  logger.debug({ errorType, outcome }, 'Recorded retry attempt');
}

/**
 * Records a successful operation after at least one retry
 *
 * Call this when an operation eventually succeeds after retries.
 *
 * @param errorType - The error type that triggered the initial retry
 */
export function recordRetrySuccess(errorType: string): void {
  retrySuccessTotal.inc({ error_type: errorType });
  logger.debug({ errorType }, 'Recorded retry success');
}

/**
 * Records when all retries are exhausted and operation failed
 *
 * Call this when an operation fails after all retry attempts.
 *
 * @param errorType - The error type that caused exhaustion
 */
export function recordRetryExhausted(errorType: string): void {
  retryExhaustedTotal.inc({ error_type: errorType });
  logger.debug({ errorType }, 'Recorded retry exhausted');
}

/**
 * Gets current metrics as Prometheus text format
 * @returns Prometheus-formatted metrics string
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Gets metrics content type
 * @returns Content type for Prometheus metrics
 */
export function getMetricsContentType(): string {
  return register.contentType;
}

/**
 * Resets all metrics (useful for testing)
 */
export function resetMetrics(): void {
  register.resetMetrics();
  logger.debug('All metrics reset');
}

logger.info('Prometheus metrics initialized');
