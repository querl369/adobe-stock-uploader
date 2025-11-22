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
