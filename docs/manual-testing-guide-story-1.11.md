# Manual Testing Guide - Story 1.11 & Epic 1 Validation

**Story:** 1.11 - Health Checks & Readiness Probes  
**Date:** 2025-11-22  
**Tester:** Manual QA Guide  
**Purpose:** Validate health endpoints and overall Epic 1 functionality

---

## Prerequisites

Before starting manual tests, ensure:

1. **Environment Setup:**

   ```bash
   # Install dependencies
   npm install

   # Ensure .env file exists with required variables
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ```

2. **Server Running:**

   ```bash
   # Start the server in development mode
   npm run dev

   # Or in production mode
   npm start
   ```

3. **Tools Ready:**
   - Terminal with `curl` command
   - Web browser (Chrome/Firefox)
   - Postman or similar API client (optional)
   - Test image file (JPG/PNG in `reference_images/` directory)

---

## Story 1.11: Health Check Endpoints

### Test Case 1.11-M1: Liveness Probe (`GET /health`)

**Acceptance Criteria:** Returns 200 with basic status, response time <50ms

#### Test Steps:

1. **Basic Health Check:**

   ```bash
   curl -i http://localhost:3000/health
   ```

   **Expected Response:**

   ```http
   HTTP/1.1 200 OK
   Content-Type: application/json

   {
     "status": "ok",
     "timestamp": "2025-11-22T10:30:45.123Z"
   }
   ```

   **Verify:**
   - ✅ Status code is 200
   - ✅ Response includes `status: "ok"`
   - ✅ Response includes timestamp in ISO 8601 format
   - ✅ Response time is <50ms (check timing in terminal or browser dev tools)

2. **Liveness Check When Server is Running:**

   ```bash
   # Multiple rapid requests to verify consistency
   for i in {1..5}; do
     curl -s http://localhost:3000/health | jq '.status'
     sleep 1
   done
   ```

   **Expected:** All 5 requests return `"ok"`

3. **Liveness Check Timing:**

   ```bash
   # Use curl's timing features
   curl -w "\nTime: %{time_total}s\n" http://localhost:3000/health
   ```

   **Expected:** Time should be <0.05s (50ms)

---

### Test Case 1.11-M2: Readiness Probe (`GET /health/ready`)

**Acceptance Criteria:** Checks config, OpenAI, filesystem; returns 200 if all pass, 503 if any fail

#### Test Steps:

1. **Readiness Check - All Systems Healthy:**

   ```bash
   curl -i http://localhost:3000/health/ready
   ```

   **Expected Response:**

   ```http
   HTTP/1.1 200 OK
   Content-Type: application/json

   {
     "status": "ready",
     "checks": {
       "config": true,
       "openai": true,
       "filesystem": true
     },
     "timestamp": "2025-11-22T10:30:45.123Z"
   }
   ```

   **Verify:**
   - ✅ Status code is 200
   - ✅ `status: "ready"`
   - ✅ All checks are `true`
   - ✅ Timestamp present

2. **Readiness Check - Config Validation:**

   ```bash
   # This should work if .env is properly configured
   curl -s http://localhost:3000/health/ready | jq '.checks.config'
   ```

   **Expected:** `true`

   **What it checks:**
   - `config.openai.apiKey` exists
   - Configuration loaded successfully
   - No validation errors

3. **Readiness Check - OpenAI Reachability:**

   ```bash
   # This verifies OpenAI API is accessible
   curl -s http://localhost:3000/health/ready | jq '.checks.openai'
   ```

   **Expected:** `true`

   **What it checks:**
   - OpenAI API endpoint is reachable
   - API key is valid (performs lightweight test call)
   - Network connectivity to OpenAI

4. **Readiness Check - Filesystem Writable:**

   ```bash
   # Verifies temp directory is writable
   curl -s http://localhost:3000/health/ready | jq '.checks.filesystem'
   ```

   **Expected:** `true`

   **What it checks:**
   - `/temp` directory exists and is writable
   - Can create and delete test files
   - No permission issues

---

### Test Case 1.11-M3: Readiness Failure Scenarios

**Purpose:** Verify proper 503 responses when checks fail

#### Scenario 1: Invalid OpenAI API Key

1. **Setup:**

   ```bash
   # Stop the server
   # Edit .env and set invalid OPENAI_API_KEY=invalid_key
   # Restart server
   npm run dev
   ```

2. **Test:**

   ```bash
   curl -i http://localhost:3000/health/ready
   ```

   **Expected Response:**

   ```http
   HTTP/1.1 503 Service Unavailable
   Content-Type: application/json

   {
     "status": "not_ready",
     "checks": {
       "config": true,
       "openai": false,
       "filesystem": true
     },
     "timestamp": "2025-11-22T10:30:45.123Z",
     "error": "OpenAI API check failed"
   }
   ```

   **Verify:**
   - ✅ Status code is 503 (not 200)
   - ✅ `status: "not_ready"`
   - ✅ `openai: false`
   - ✅ Other checks still `true`
   - ✅ Error message provided

3. **Cleanup:** Restore valid OPENAI_API_KEY and restart server

---

#### Scenario 2: Filesystem Not Writable

1. **Setup:**

   ```bash
   # Make /temp directory read-only
   chmod 444 temp/
   ```

2. **Test:**

   ```bash
   curl -i http://localhost:3000/health/ready
   ```

   **Expected Response:**

   ```http
   HTTP/1.1 503 Service Unavailable

   {
     "status": "not_ready",
     "checks": {
       "config": true,
       "openai": true,
       "filesystem": false
     },
     "error": "Filesystem check failed"
   }
   ```

   **Verify:**
   - ✅ Status code is 503
   - ✅ `filesystem: false`
   - ✅ Error indicates filesystem issue

3. **Cleanup:**
   ```bash
   # Restore write permissions
   chmod 755 temp/
   ```

---

### Test Case 1.11-M4: Timeout Handling

**Acceptance Criteria:** Readiness checks timeout after 5 seconds

#### Test Steps:

1. **Simulate Slow OpenAI Response:**

   ```bash
   # If OpenAI is experiencing issues, readiness should timeout
   # Test by temporarily blocking OpenAI network access

   # On macOS/Linux, you can test timeout behavior:
   # Add OpenAI API endpoint to /etc/hosts pointing to a slow/dead IP
   # (Advanced - skip if uncomfortable with system config)

   # Or simply observe timing:
   time curl http://localhost:3000/health/ready
   ```

   **Expected:**
   - If OpenAI is reachable: <5 seconds response
   - If OpenAI times out: ~5 seconds response with 503

2. **Normal Timing:**

   ```bash
   # Typical readiness check should be fast
   curl -w "\nTime: %{time_total}s\n" http://localhost:3000/health/ready
   ```

   **Expected:** <1 second typical, <5 seconds maximum

---

### Test Case 1.11-M5: Logging and Error Details

**Purpose:** Verify failed checks log detailed errors

#### Test Steps:

1. **Monitor Logs During Readiness Check:**

   ```bash
   # In one terminal, tail the logs
   npm run dev | grep -i "health"

   # In another terminal, trigger readiness check
   curl http://localhost:3000/health/ready
   ```

   **Expected Log Output:**

   ```json
   {"level":"info","msg":"Health check: liveness probe"}
   {"level":"info","msg":"Health check: readiness probe started"}
   {"level":"info","checks":{"config":true,"openai":true,"filesystem":true},"msg":"Health check: readiness probe completed"}
   ```

2. **Monitor Logs During Failure:**

   ```bash
   # With invalid config, check logs
   curl http://localhost:3000/health/ready
   ```

   **Expected:**

   ```json
   { "level": "warn", "check": "openai", "msg": "Readiness check failed: OpenAI API unreachable" }
   ```

---

### Test Case 1.11-M6: Container Orchestrator Simulation

**Purpose:** Simulate how Railway/Render will use health checks

#### Test Steps:

1. **Startup Sequence:**

   ```bash
   # Start server
   npm run dev

   # Immediately check liveness (should succeed quickly)
   curl http://localhost:3000/health

   # Check readiness (might take a moment for OpenAI validation)
   curl http://localhost:3000/health/ready
   ```

   **Expected:**
   - Liveness: Immediate 200
   - Readiness: 200 after brief delay (<5s)

2. **Repeated Health Checks (Simulate Monitoring):**

   ```bash
   # Simulate container orchestrator polling every 10 seconds
   while true; do
     echo "$(date): Liveness check"
     curl -s http://localhost:3000/health | jq '.status'

     echo "$(date): Readiness check"
     curl -s http://localhost:3000/health/ready | jq '.status'

     sleep 10
   done
   ```

   **Expected:** Consistent `"ok"` and `"ready"` responses

3. **Graceful Shutdown Behavior:**

   ```bash
   # Start the polling script above, then stop the server
   # Ctrl+C the server process

   # Observe health check failures in polling script
   ```

   **Expected:**
   - Health checks fail with connection errors after server stops
   - Container orchestrator would mark service as unhealthy

---

## Epic 1 Integration Tests

### Test Case E1-M1: Full Request with Health Checks

**Purpose:** Verify health endpoints don't interfere with normal operation

#### Test Steps:

1. **Health Check + Image Upload:**

   ```bash
   # Check health
   curl http://localhost:3000/health

   # Upload an image (existing Epic 1 functionality)
   curl -X POST http://localhost:3000/api/upload \
     -F "image=@reference_images/_MG_0024-2.jpg"

   # Check health again
   curl http://localhost:3000/health
   ```

   **Expected:**
   - All requests succeed
   - Health checks unaffected by image processing

2. **Health Check During Processing:**

   ```bash
   # Start a batch upload (this might take time)
   curl -X POST http://localhost:3000/api/upload \
     -F "image=@reference_images/_MG_0024-2.jpg" &

   # Immediately check health while processing
   curl http://localhost:3000/health
   curl http://localhost:3000/health/ready
   ```

   **Expected:**
   - Health checks return quickly even during processing
   - Readiness remains `true`

---

### Test Case E1-M2: Metrics and Health Correlation

**Purpose:** Verify metrics endpoint and health checks both work

#### Test Steps:

```bash
# Check metrics
curl http://localhost:3000/metrics | head -20

# Check health
curl http://localhost:3000/health

# Verify both accessible
echo "Both endpoints should be accessible without auth"
```

**Expected:**

- ✅ `/metrics` returns Prometheus format
- ✅ `/health` returns JSON health status
- ✅ Both unprotected (no authentication required)

---

### Test Case E1-M3: Logging and Health Checks

**Purpose:** Verify health checks use structured logging

#### Test Steps:

```bash
# Tail logs with pretty-print
npm run dev | pino-pretty

# In another terminal, trigger health checks
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
```

**Expected Log Format:**

```
[2025-11-22 10:30:45] INFO: Health check: liveness probe
[2025-11-22 10:30:46] INFO: Health check: readiness probe started
[2025-11-22 10:30:46] INFO: Health check: readiness probe completed
    checks: {
      "config": true,
      "openai": true,
      "filesystem": true
    }
```

---

## Browser-Based Manual Tests

### Test Case B1: Health Check in Browser

1. **Open Browser:**

   ```
   http://localhost:3000/health
   ```

   **Expected:**
   - JSON response displayed
   - `status: "ok"`
   - Timestamp present

2. **Open Readiness:**

   ```
   http://localhost:3000/health/ready
   ```

   **Expected:**
   - JSON response with all checks
   - All checks `true`
   - Status 200 (check browser dev tools → Network tab)

3. **Inspect Response Headers:**
   - Open DevTools (F12)
   - Go to Network tab
   - Refresh `/health` endpoint
   - Check response headers

   **Expected Headers:**

   ```
   Content-Type: application/json
   X-Powered-By: Express (or removed if security hardened)
   ```

---

## Performance Validation

### Test Case P1: Response Time Validation

**Acceptance Criteria:** Liveness <50ms

```bash
# Test liveness response time (should be <50ms)
ab -n 100 -c 10 http://localhost:3000/health

# Or with curl timing
for i in {1..10}; do
  curl -w "Time: %{time_total}s\n" -o /dev/null -s http://localhost:3000/health
done
```

**Expected:**

- Average response time <50ms
- 100% success rate
- No timeouts

---

### Test Case P2: Concurrent Health Checks

```bash
# Simulate 50 concurrent health checks
ab -n 50 -c 50 http://localhost:3000/health

# Check for any failures
echo "All requests should succeed"
```

**Expected:**

- 100% success rate
- No 500 errors
- Server remains responsive

---

## Failure Mode Testing

### Test Case F1: Server Under Load

**Purpose:** Verify health checks work even when server is busy

```bash
# Start heavy load (batch processing)
# Simultaneously check health
curl -X POST http://localhost:3000/api/upload \
  -F "image=@reference_images/_MG_0024-2.jpg" \
  -F "image=@reference_images/_MG_0113.jpg" \
  -F "image=@reference_images/_MG_0115.jpg" &

# Check health during load
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
```

**Expected:**

- Health checks still respond quickly
- Readiness shows `true` (server is handling requests)

---

### Test Case F2: Network Partition Simulation

**Purpose:** Verify behavior when OpenAI is unreachable

```bash
# If you want to test OpenAI unreachable scenario:
# 1. Temporarily modify .env with invalid API endpoint
# 2. Restart server
# 3. Check readiness

curl -i http://localhost:3000/health/ready
```

**Expected:**

- Status 503
- `openai: false`
- Other checks still `true`

---

## Complete Manual Test Checklist

### Story 1.11 Validation ✅

- [ ] **AC1:** `/health` endpoint exists and returns 200
- [ ] **AC2:** Liveness response includes `status: "ok"` and timestamp
- [ ] **AC3:** Liveness response time <50ms
- [ ] **AC4:** `/health/ready` endpoint exists
- [ ] **AC5:** Readiness checks config loaded (returns true)
- [ ] **AC6:** Readiness checks OpenAI reachable (returns true)
- [ ] **AC7:** Readiness checks filesystem writable (returns true)
- [ ] **AC8:** Readiness returns 200 when all checks pass
- [ ] **AC9:** Readiness returns 503 when any check fails
- [ ] **AC10:** Readiness response includes check details
- [ ] **AC11:** Readiness checks timeout after 5 seconds
- [ ] **AC12:** Failed checks log detailed errors

### Epic 1 Integration ✅

- [ ] Health checks don't interfere with image upload
- [ ] Health checks don't interfere with metrics endpoint
- [ ] Health checks use structured logging (Pino)
- [ ] Health checks are unprotected (no auth required)
- [ ] Health checks work during server load
- [ ] Health checks fail gracefully when dependencies unavailable

### Performance ✅

- [ ] Liveness check responds in <50ms
- [ ] Readiness check responds in <5 seconds (including OpenAI validation)
- [ ] Health checks handle concurrent requests
- [ ] Health checks don't impact server performance

### Error Handling ✅

- [ ] Invalid OpenAI key → readiness returns 503
- [ ] Unwritable filesystem → readiness returns 503
- [ ] Network partition → readiness returns 503 after timeout
- [ ] All errors logged with details

---

## Quick Smoke Test (5 minutes)

After implementing Story 1.11, run this quick smoke test:

```bash
# 1. Start server
npm run dev

# 2. Quick health checks
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}

curl http://localhost:3000/health/ready
# Should return: {"status":"ready","checks":{...},"timestamp":"..."}

# 3. Verify in browser
open http://localhost:3000/health
open http://localhost:3000/health/ready

# 4. Check logs show health check activity
# Look for structured JSON logs with health check messages

# ✅ If all return 200 with expected JSON, Story 1.11 is working!
```

---

## Deployment Validation (Railway/Render)

After deploying to staging/production:

1. **Test Public Health Endpoint:**

   ```bash
   # Replace with your deployed URL
   curl https://your-app.railway.app/health
   curl https://your-app.railway.app/health/ready
   ```

2. **Configure Platform Health Checks:**
   - **Railway:** Set health check path to `/health`
   - **Render:** Set health check path to `/health/ready`
   - Set timeout to 5 seconds
   - Set interval to 30 seconds

3. **Monitor Platform Dashboard:**
   - Verify service shows as "healthy"
   - Check restart count (should be 0)
   - Monitor response times in platform metrics

---

## Troubleshooting

### Issue: `/health` returns 404

**Solution:**

- Verify routes are registered in `server.ts`
- Check that health routes file is imported
- Restart server

### Issue: `/health/ready` always returns 503

**Solution:**

- Check `.env` file has valid `OPENAI_API_KEY`
- Verify `/temp` directory exists and is writable: `ls -la temp/`
- Check logs for specific failure: `npm run dev | grep -i health`

### Issue: Readiness check times out

**Solution:**

- Verify internet connectivity
- Check OpenAI API status (status.openai.com)
- Increase timeout (if needed) in health check implementation

---

## Success Criteria

✅ **Story 1.11 Complete When:**

- All 12 acceptance criteria validated manually
- Health checks respond correctly in all scenarios
- Failed checks return proper 503 responses
- Logs show detailed error information
- Performance meets <50ms liveness, <5s readiness targets
- Integration with Epic 1 confirmed (no regressions)

---

**Happy Testing!** 🧪

Remember: Manual testing complements automated tests. After manual validation, consider adding automated E2E tests for health endpoints to prevent regressions.

---

<!-- Manual Test Guide for Story 1.11 -->
<!-- Generated: 2025-11-22 -->
<!-- Test Architect: Murat (TEA) -->
