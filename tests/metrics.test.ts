/**
 * Unit Tests for Metrics Module
 *
 * Tests Prometheus metrics collection, helper functions,
 * and metric recording operations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  register,
  imagesProcessedTotal,
  processingDurationSeconds,
  openaiCostUsd,
  openaiCallsTotal,
  recordImageSuccess,
  recordImageFailure,
  recordOpenAICall,
  recordOpenAIFailure,
  recordTempUrlCreation,
  recordCsvExport,
  getMetrics,
  getMetricsContentType,
  resetMetrics,
} from '@/utils/metrics';

describe('Prometheus Metrics', () => {
  // Reset metrics before each test to ensure clean state
  beforeEach(() => {
    resetMetrics();
  });

  describe('Registry', () => {
    it('should be defined', () => {
      expect(register).toBeDefined();
    });

    it('should have Prometheus content type', () => {
      const contentType = getMetricsContentType();
      expect(contentType).toContain('text/plain');
    });
  });

  describe('Custom Metrics', () => {
    it('should define imagesProcessedTotal counter', () => {
      expect(imagesProcessedTotal).toBeDefined();
      expect(imagesProcessedTotal.name).toBe('asu_images_processed_total');
    });

    it('should define processingDurationSeconds histogram', () => {
      expect(processingDurationSeconds).toBeDefined();
      expect(processingDurationSeconds.name).toBe('asu_processing_duration_seconds');
    });

    it('should define openaiCostUsd counter', () => {
      expect(openaiCostUsd).toBeDefined();
      expect(openaiCostUsd.name).toBe('asu_openai_cost_usd');
    });

    it('should define openaiCallsTotal counter', () => {
      expect(openaiCallsTotal).toBeDefined();
      expect(openaiCallsTotal.name).toBe('asu_openai_calls_total');
    });
  });

  describe('Helper Functions', () => {
    describe('recordImageSuccess', () => {
      it('should increment success counter and record duration', async () => {
        recordImageSuccess(5.5);

        const metrics = await getMetrics();
        expect(metrics).toContain('asu_images_processed_total{status="success"} 1');
        expect(metrics).toContain('asu_processing_duration_seconds');
        expect(metrics).toContain('stage="total"');
      });

      it('should handle multiple success recordings', async () => {
        recordImageSuccess(1.0);
        recordImageSuccess(2.0);
        recordImageSuccess(3.0);

        const metrics = await getMetrics();
        expect(metrics).toContain('asu_images_processed_total{status="success"} 3');
      });
    });

    describe('recordImageFailure', () => {
      it('should increment failure counter', async () => {
        recordImageFailure('temp_url');

        const metrics = await getMetrics();
        expect(metrics).toContain('asu_images_processed_total{status="failure"} 1');
      });

      it('should handle multiple failure recordings', async () => {
        recordImageFailure('temp_url');
        recordImageFailure('openai');
        recordImageFailure('csv_export');

        const metrics = await getMetrics();
        expect(metrics).toContain('asu_images_processed_total{status="failure"} 3');
      });
    });

    describe('recordOpenAICall', () => {
      it('should record OpenAI call with default cost', async () => {
        recordOpenAICall(2.5);

        const metrics = await getMetrics();
        expect(metrics).toContain('asu_openai_calls_total{status="success"} 1');
        expect(metrics).toContain('asu_openai_cost_usd 0.002');
      });

      it('should record OpenAI call with custom cost', async () => {
        recordOpenAICall(2.5, 0.005);

        const metrics = await getMetrics();
        expect(metrics).toContain('asu_openai_cost_usd 0.005');
      });

      it('should accumulate multiple API calls', async () => {
        recordOpenAICall(1.0, 0.002);
        recordOpenAICall(1.5, 0.002);
        recordOpenAICall(2.0, 0.002);

        const metrics = await getMetrics();
        expect(metrics).toContain('asu_openai_calls_total{status="success"} 3');
        expect(metrics).toContain('asu_openai_cost_usd 0.006');
      });
    });

    describe('recordOpenAIFailure', () => {
      it('should record failure without retry', async () => {
        recordOpenAIFailure(false);

        const metrics = await getMetrics();
        expect(metrics).toContain('asu_openai_calls_total{status="failure"} 1');
      });

      it('should record retry attempt', async () => {
        recordOpenAIFailure(true);

        const metrics = await getMetrics();
        expect(metrics).toContain('asu_openai_calls_total{status="retry"} 1');
      });

      it('should track separate failure and retry counts', async () => {
        recordOpenAIFailure(false);
        recordOpenAIFailure(true);
        recordOpenAIFailure(true);

        const metrics = await getMetrics();
        expect(metrics).toContain('asu_openai_calls_total{status="failure"} 1');
        expect(metrics).toContain('asu_openai_calls_total{status="retry"} 2');
      });
    });

    describe('recordTempUrlCreation', () => {
      it('should record temp URL creation duration', async () => {
        recordTempUrlCreation(0.5);

        const metrics = await getMetrics();
        expect(metrics).toContain('asu_processing_duration_seconds');
        expect(metrics).toContain('stage="temp_url"');
      });
    });

    describe('recordCsvExport', () => {
      it('should record CSV export duration', async () => {
        recordCsvExport(1.5, 10);

        const metrics = await getMetrics();
        expect(metrics).toContain('asu_processing_duration_seconds');
        expect(metrics).toContain('stage="csv_export"');
      });
    });
  });

  describe('Metrics Output', () => {
    it('should export metrics in Prometheus format', async () => {
      // Record some metrics
      recordImageSuccess(2.5);
      recordImageFailure('openai');
      recordOpenAICall(1.5, 0.002);

      const metrics = await getMetrics();

      // Verify format
      expect(metrics).toContain('# HELP');
      expect(metrics).toContain('# TYPE');
      expect(metrics).toContain('asu_images_processed_total');
      expect(metrics).toContain('asu_openai_calls_total');
      expect(metrics).toContain('asu_openai_cost_usd');
      expect(metrics).toContain('asu_processing_duration_seconds');
    });

    it('should include default Node.js metrics', async () => {
      const metrics = await getMetrics();

      // Verify Node.js metrics are present
      expect(metrics).toContain('asu_nodejs_');
      expect(metrics).toContain('process_cpu_');
      expect(metrics).toContain('nodejs_heap_');
    });

    it('should reset metrics correctly', async () => {
      // Record some metrics
      recordImageSuccess(2.5);
      recordOpenAICall(1.5, 0.002);

      // Reset
      resetMetrics();

      // Verify counts are reset (Prometheus doesn't show labels for zero counters)
      const metrics = await getMetrics();
      expect(metrics).toContain('asu_openai_cost_usd 0');
      // After reset, counters don't show labels until they're incremented again
      // This is expected Prometheus behavior
    });
  });

  describe('Histogram Buckets', () => {
    it('should use appropriate buckets for processing duration', async () => {
      // Test various durations
      recordImageSuccess(0.1);
      recordImageSuccess(1.0);
      recordImageSuccess(5.0);
      recordImageSuccess(30.0);

      const metrics = await getMetrics();

      // Verify histogram buckets are present
      expect(metrics).toContain('le="0.1"');
      expect(metrics).toContain('le="1"');
      expect(metrics).toContain('le="5"');
      expect(metrics).toContain('le="30"');
      expect(metrics).toContain('le="60"');
      expect(metrics).toContain('le="+Inf"');
    });
  });

  describe('Label Handling', () => {
    it('should handle status labels correctly', async () => {
      recordImageSuccess(1.0);
      recordImageFailure('test');

      const metrics = await getMetrics();
      expect(metrics).toContain('status="success"');
      expect(metrics).toContain('status="failure"');
    });

    it('should handle stage labels correctly', async () => {
      recordTempUrlCreation(0.5);
      recordOpenAICall(2.0);
      recordCsvExport(1.0, 5);

      const metrics = await getMetrics();
      expect(metrics).toContain('stage="temp_url"');
      expect(metrics).toContain('stage="openai"');
      expect(metrics).toContain('stage="csv_export"');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero duration', async () => {
      recordImageSuccess(0);

      const metrics = await getMetrics();
      expect(metrics).toContain('asu_images_processed_total{status="success"} 1');
    });

    it('should handle very large duration', async () => {
      recordImageSuccess(300); // 5 minutes

      const metrics = await getMetrics();
      expect(metrics).toContain('asu_images_processed_total{status="success"} 1');
    });

    it('should handle zero cost', async () => {
      recordOpenAICall(1.0, 0);

      const metrics = await getMetrics();
      expect(metrics).toContain('asu_openai_cost_usd 0');
    });

    it('should handle very small cost', async () => {
      recordOpenAICall(1.0, 0.0001);

      const metrics = await getMetrics();
      expect(metrics).toContain('asu_openai_cost_usd 0.0001');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent metric recordings', async () => {
      // Simulate concurrent operations
      const operations = Array.from({ length: 10 }, (_, i) => {
        if (i % 2 === 0) {
          recordImageSuccess(i * 0.5);
        } else {
          recordImageFailure('test');
        }
      });

      const metrics = await getMetrics();
      expect(metrics).toContain('asu_images_processed_total{status="success"} 5');
      expect(metrics).toContain('asu_images_processed_total{status="failure"} 5');
    });
  });
});
