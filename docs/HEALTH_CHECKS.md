# Health Check Endpoints

This document describes the health check endpoints for the Adobe Stock Uploader application.

## Overview

Health check endpoints are used by container orchestrators (Railway, Render, Kubernetes, etc.) to monitor application status and manage traffic routing. We implement two types of health checks:

1. **Liveness probe** - Checks if the application is running
2. **Readiness probe** - Checks if the application is ready to serve traffic

## Endpoints

### GET /health - Liveness Probe

Simple health check that returns 200 if the server is running.

**Purpose:** Used by orchestrators to determine if the container should be restarted.

**Characteristics:**

- No external dependency checks
- Fast response (<50ms)
- Always returns 200 if server is responding

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-11-22T12:00:00.000Z"
}
```

**Status Codes:**

- `200 OK` - Server is running

---

### GET /health/ready - Readiness Probe

Comprehensive health check that verifies all critical dependencies are available.

**Purpose:** Used by orchestrators/load balancers to determine if the container should receive traffic.

**Dependencies Checked:**

1. **Configuration** - Required environment variables loaded
2. **OpenAI API** - AI service is reachable (with 5s timeout)
3. **Filesystem** - Temp directory is writable

**Response (Success):**

```json
{
  "status": "ready",
  "timestamp": "2025-11-22T12:00:00.000Z",
  "checks": {
    "config": true,
    "openai": true,
    "filesystem": true
  }
}
```

**Response (Failure):**

```json
{
  "status": "unavailable",
  "timestamp": "2025-11-22T12:00:00.000Z",
  "checks": {
    "config": true,
    "openai": false,
    "filesystem": true
  }
}
```

**Status Codes:**

- `200 OK` - All checks pass, ready to serve traffic
- `503 Service Unavailable` - One or more checks failed

**Timeouts:**

- All dependency checks timeout after 5 seconds
- If timeout occurs, check is marked as failed

## Implementation Details

### Health Check Logic

```typescript
// Liveness: Always returns ok if server responds
GET /health → { status: "ok", timestamp: "..." }

// Readiness: Checks dependencies
GET /health/ready → {
  status: allChecksPassed ? "ready" : "unavailable",
  checks: { config, openai, filesystem }
}
```

### Configuration Check

- Verifies `OPENAI_API_KEY` is present
- Verifies `BASE_URL` is configured
- Verifies `PORT` is set
- Fast check, no external calls

### OpenAI Check

- Calls `openai.models.list()` API
- Lightweight endpoint (no token cost)
- 5-second timeout
- Logs failures for monitoring

### Filesystem Check

- Writes test file to `temp/` directory
- Reads file to verify write succeeded
- Deletes test file
- 5-second timeout

## Deployment Configuration

### Railway/Render

Configure health checks in your deployment settings:

```yaml
# Railway
healthcheck:
  path: /health
  interval: 30s
  timeout: 10s

# Render
healthCheckPath: /health
```

### Kubernetes

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 5
  failureThreshold: 3
```

### Docker Compose

```yaml
healthcheck:
  test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## Monitoring

### Logging

Health check failures are logged with structured details:

```json
{
  "level": "warn",
  "msg": "Readiness check failed",
  "checks": {
    "config": true,
    "openai": false,
    "filesystem": true
  }
}
```

### Metrics

Health checks are exposed via Prometheus metrics:

- Request counts per endpoint
- Response times
- Failure rates

Query at: `GET /metrics`

## Testing

Run health check tests:

```bash
npm test tests/health.routes.test.ts
```

Test coverage:

- Liveness probe response format
- Readiness probe with all checks passing
- Readiness probe with failing checks
- Response time requirements (<50ms for liveness)
- Timeout behavior (5s for readiness)
- Error handling

## Usage Examples

### cURL

```bash
# Liveness check
curl http://localhost:3000/health

# Readiness check
curl http://localhost:3000/health/ready
```

### JavaScript

```javascript
// Check if service is ready
async function isServiceReady() {
  const response = await fetch('http://localhost:3000/health/ready');
  const data = await response.json();
  return response.ok && data.status === 'ready';
}
```

### Shell Script

```bash
#!/bin/bash
# Wait for service to be ready before proceeding

until curl -sf http://localhost:3000/health/ready > /dev/null; do
  echo "Waiting for service to be ready..."
  sleep 2
done

echo "Service is ready!"
```

## Troubleshooting

### Readiness Check Always Failing

**Symptom:** `/health/ready` returns 503

**Possible Causes:**

1. **Config check fails:**
   - Missing or invalid `OPENAI_API_KEY`
   - Invalid `BASE_URL` format
   - Check `.env` file configuration

2. **OpenAI check fails:**
   - Invalid API key
   - Network connectivity issues
   - OpenAI service outage
   - Firewall blocking outbound HTTPS

3. **Filesystem check fails:**
   - No write permissions to `temp/` directory
   - Disk full
   - Directory doesn't exist (should auto-create)

**Debug Steps:**

```bash
# Check logs for detailed error messages
npm start | grep "check failed"

# Verify configuration manually
node -e "require('dotenv').config(); console.log(process.env.OPENAI_API_KEY)"

# Test filesystem access
touch temp/.health-check && rm temp/.health-check

# Test OpenAI connectivity
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models
```

### Slow Response Times

**Symptom:** Health checks take longer than expected

**Solutions:**

- Increase timeout in orchestrator configuration
- Check OpenAI API latency
- Investigate network issues
- Consider increasing readiness timeout to 10s

## Best Practices

1. **Don't use readiness for liveness**
   - Liveness should be simple and fast
   - Readiness can be more thorough

2. **Set appropriate timeouts**
   - Liveness: 5s or less
   - Readiness: 10s recommended

3. **Monitor health check metrics**
   - Track failure rates
   - Alert on sustained failures
   - Investigate patterns

4. **Test before deploying**
   - Verify health checks work locally
   - Test with actual dependencies
   - Simulate failure scenarios

5. **Document expectations**
   - What each check validates
   - Expected response times
   - Failure recovery procedures

## References

- [Kubernetes Liveness/Readiness Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Railway Health Checks](https://docs.railway.app/deploy/healthchecks)
- [Render Health Checks](https://render.com/docs/deploys#health-checks)
- [Docker HEALTHCHECK](https://docs.docker.com/engine/reference/builder/#healthcheck)

---

**Implementation:** Story 1.11 - Health Checks & Readiness Probes
**Date:** November 22, 2025
