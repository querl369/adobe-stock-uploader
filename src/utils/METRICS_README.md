# Prometheus Metrics Documentation

This document describes all Prometheus metrics collected by the Adobe Stock Uploader application.

## Metrics Endpoint

**URL:** `GET /metrics`

**Content-Type:** `text/plain` (Prometheus format)

**Access:** Unprotected (for Prometheus scraper access)

**Response:** Returns all collected metrics in Prometheus text format

## Collected Metrics

### Default Node.js Metrics

The application automatically collects standard Node.js runtime metrics with the `asu_nodejs_` prefix:

- **CPU Usage:** `asu_nodejs_process_cpu_user_seconds_total`, `asu_nodejs_process_cpu_system_seconds_total`
- **Memory:** `asu_nodejs_process_resident_memory_bytes`, `asu_nodejs_nodejs_heap_size_total_bytes`, `asu_nodejs_nodejs_heap_size_used_bytes`
- **Event Loop:** `asu_nodejs_nodejs_eventloop_lag_seconds`, `asu_nodejs_nodejs_eventloop_lag_p50_seconds`, `asu_nodejs_nodejs_eventloop_lag_p99_seconds`
- **GC Duration:** `asu_nodejs_nodejs_gc_duration_seconds` (histogram with buckets: 0.001, 0.01, 0.1, 1, 2, 5 seconds)
- **Active Resources:** `asu_nodejs_nodejs_active_resources`, `asu_nodejs_nodejs_active_handles`, `asu_nodejs_nodejs_active_requests`

### Custom Application Metrics

#### 1. `asu_images_processed_total` (Counter)

Tracks the total number of images processed by the application.

**Labels:**

- `status`: `success` | `failure`

**Example:**

```prometheus
asu_images_processed_total{status="success"} 1542
asu_images_processed_total{status="failure"} 23
```

**Usage:**

```typescript
import { recordImageSuccess, recordImageFailure } from '@/utils/metrics';

recordImageSuccess(durationSeconds); // Increments success counter
recordImageFailure('stage-name'); // Increments failure counter
```

---

#### 2. `asu_processing_duration_seconds` (Histogram)

Measures the duration of various processing stages.

**Labels:**

- `stage`: `temp_url` | `openai` | `csv_export` | `total`

**Buckets:** 0.1, 0.5, 1, 2, 5, 10, 30, 60 seconds

**Example:**

```prometheus
asu_processing_duration_seconds_bucket{stage="openai",le="5"} 1234
asu_processing_duration_seconds_sum{stage="openai"} 4567.89
asu_processing_duration_seconds_count{stage="openai"} 1542
```

**Usage:**

```typescript
import { recordOpenAICall, recordTempUrlCreation, recordCsvExport } from '@/utils/metrics';

recordTempUrlCreation(durationSeconds);
recordOpenAICall(durationSeconds, costUsd);
recordCsvExport(durationSeconds, imageCount);
```

**Use Cases:**

- Monitor processing performance by stage
- Identify bottlenecks (e.g., if OpenAI stage is slow)
- Track SLA compliance (e.g., 95% of images processed in < 10s)

---

#### 3. `asu_openai_cost_usd` (Counter)

Cumulative OpenAI API costs in USD.

**Labels:** None

**Example:**

```prometheus
asu_openai_cost_usd 24.56
```

**Usage:**

```typescript
import { recordOpenAICall } from '@/utils/metrics';

recordOpenAICall(durationSeconds, 0.002); // $0.002 per image
```

**Cost Model (as of 2025):**

- `gpt-5-nano` vision: ~$0.002 per image
- Cost is tracked automatically when `recordOpenAICall()` is called

---

#### 4. `asu_openai_calls_total` (Counter)

Total number of OpenAI API calls (including retries).

**Labels:**

- `status`: `success` | `failure` | `retry`

**Example:**

```prometheus
asu_openai_calls_total{status="success"} 1542
asu_openai_calls_total{status="failure"} 12
asu_openai_calls_total{status="retry"} 45
```

**Usage:**

```typescript
import { recordOpenAICall, recordOpenAIFailure } from '@/utils/metrics';

recordOpenAICall(durationSeconds); // Increments success counter
recordOpenAIFailure(false); // Increments failure counter
recordOpenAIFailure(true); // Increments retry counter
```

**Use Cases:**

- Monitor API reliability
- Track retry patterns
- Detect rate limit issues

---

## Prometheus Queries

### Common Queries

**1. Images processed per minute:**

```promql
rate(asu_images_processed_total[1m])
```

**2. Success rate (last hour):**

```promql
sum(rate(asu_images_processed_total{status="success"}[1h])) /
sum(rate(asu_images_processed_total[1h])) * 100
```

**3. Average processing time (p95):**

```promql
histogram_quantile(0.95, rate(asu_processing_duration_seconds_bucket{stage="total"}[5m]))
```

**4. OpenAI API costs per hour:**

```promql
rate(asu_openai_cost_usd[1h]) * 3600
```

**5. OpenAI API error rate:**

```promql
rate(asu_openai_calls_total{status="failure"}[5m]) /
rate(asu_openai_calls_total[5m]) * 100
```

**6. Processing bottleneck analysis:**

```promql
avg by (stage) (rate(asu_processing_duration_seconds_sum[5m]) / rate(asu_processing_duration_seconds_count[5m]))
```

---

## Grafana Dashboard

### Recommended Panels

1. **Images Processed (Graph)**
   - Query: `rate(asu_images_processed_total[5m]) * 60`
   - Legend: `{{status}}`
   - Y-axis: Images per minute

2. **Success Rate (Gauge)**
   - Query: Success rate formula above
   - Thresholds: Green (>95%), Yellow (90-95%), Red (<90%)

3. **Processing Duration p95 (Graph)**
   - Query: p95 formula above
   - Legend: `{{stage}}`
   - Y-axis: Seconds

4. **OpenAI API Costs (Graph)**
   - Query: `rate(asu_openai_cost_usd[1h]) * 3600`
   - Y-axis: USD per hour

5. **OpenAI API Reliability (Graph)**
   - Queries:
     - Success: `rate(asu_openai_calls_total{status="success"}[5m])`
     - Failure: `rate(asu_openai_calls_total{status="failure"}[5m])`
     - Retry: `rate(asu_openai_calls_total{status="retry"}[5m])`
   - Legend: `{{status}}`

---

## Alerting Rules

### Recommended Alerts

**1. High Error Rate:**

```yaml
- alert: HighImageProcessingErrorRate
  expr: |
    (rate(asu_images_processed_total{status="failure"}[5m]) /
     rate(asu_images_processed_total[5m])) > 0.1
  for: 5m
  annotations:
    summary: 'Image processing error rate above 10%'
```

**2. Slow Processing:**

```yaml
- alert: SlowImageProcessing
  expr: |
    histogram_quantile(0.95, rate(asu_processing_duration_seconds_bucket{stage="total"}[5m])) > 30
  for: 10m
  annotations:
    summary: 'P95 processing time above 30 seconds'
```

**3. OpenAI API Issues:**

```yaml
- alert: OpenAIAPIHighFailureRate
  expr: |
    (rate(asu_openai_calls_total{status="failure"}[5m]) /
     rate(asu_openai_calls_total[5m])) > 0.05
  for: 5m
  annotations:
    summary: 'OpenAI API failure rate above 5%'
```

**4. High Costs:**

```yaml
- alert: HighOpenAICosts
  expr: rate(asu_openai_cost_usd[1h]) * 3600 * 24 > 100
  for: 1h
  annotations:
    summary: 'OpenAI costs projected to exceed $100/day'
```

---

## Integration with Prometheus

### Prometheus Configuration

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'adobe-stock-uploader'
    scrape_interval: 30s
    static_configs:
      - targets: ['localhost:3001']
```

### Docker Compose Example

```yaml
version: '3'
services:
  app:
    image: adobe-stock-uploader
    ports:
      - '3001:3001'

  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - '9090:9090'

  grafana:
    image: grafana/grafana
    ports:
      - '3000:3000'
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

---

## Testing Metrics

### Manual Testing

1. **Start the server:**

   ```bash
   npm run dev
   ```

2. **Access metrics endpoint:**

   ```bash
   curl http://localhost:3001/metrics
   ```

3. **Process some images:**

   ```bash
   # Upload and process images via API
   curl -X POST http://localhost:3001/api/process-batch ...
   ```

4. **Verify metrics updated:**
   ```bash
   curl http://localhost:3001/metrics | grep asu_images_processed_total
   ```

### Automated Testing

Run the test suite:

```bash
npm test tests/metrics.test.ts
npm test tests/server.integration.test.ts
```

---

## Troubleshooting

### Metrics Not Updating

1. **Check if metrics module is imported:**
   - Ensure `src/utils/metrics.ts` is loaded on server startup
   - Check logs for "Prometheus metrics initialized" message

2. **Verify helper functions are called:**
   - Search codebase for `recordImageSuccess()`, `recordOpenAICall()`, etc.
   - Add logging to verify functions are being called

3. **Test metrics endpoint:**
   ```bash
   curl http://localhost:3001/metrics
   ```

### Metrics Reset After Restart

- **Expected behavior:** Prometheus metrics are in-memory and reset on server restart
- **Solution:** Use Prometheus server with persistent storage for historical data

### High Memory Usage

- **Cause:** Too many metric labels or high cardinality
- **Solution:**
  - Limit label cardinality
  - Use aggregation queries
  - Consider using histogram buckets appropriately

---

## Further Reading

- [Prometheus Documentation](https://prometheus.io/docs/introduction/overview/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
- [Grafana Dashboards](https://grafana.com/docs/grafana/latest/dashboards/)
- [Node.js Metrics with prom-client](https://github.com/siimon/prom-client)
