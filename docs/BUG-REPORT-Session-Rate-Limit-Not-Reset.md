# BUG REPORT: Session Rate Limit Not Reset on Cleanup or Image Deletion

**Issue ID:** Session-Rate-Limit-No-Reset
**Priority:** HIGH
**Status:** Open
**Discovered By:** Manual testing during Story 5.1 code review
**Date:** 2026-03-19
**Affects:** Epic 2 — Stories 2.2 (Session Tracking), 2.3 (Rate Limiting)

---

## Summary

The session-based upload rate limit (10 images per session) is never decremented or reset. Once images are counted via `SessionService.incrementUsage()`, the count is permanent until the session expires (1 hour of inactivity). Neither the `/api/cleanup` endpoint nor individual image deletion reduces the counter.

---

## Steps to Reproduce

1. Start dev server: `npm run dev`
2. Open app at `http://localhost:5173`
3. Upload several images (e.g., 5)
4. Delete all images individually (X button on each thumbnail)
5. Try to upload new images
6. **Result:** 429 Too Many Requests — "Request failed"

Alternative reproduction:

1. Upload 10 images (hits the session limit)
2. Click "Clear" (calls `/api/cleanup`)
3. Try to upload again
4. **Result:** 429 Too Many Requests

---

## Root Cause

**`SessionService`** (`src/services/session.service.ts`):

- `incrementUsage(sessionId, count)` adds to `imagesProcessed` on every upload
- No `decrementUsage()` or `resetUsage()` method exists
- `imagesProcessed` only resets when the session expires (1 hour inactivity)

**`/api/cleanup` endpoint** (`server.ts`):

- Deletes files from `/uploads` and `/images` directories
- Does NOT interact with `SessionService` — session counter unchanged

**Rate limit middleware** (`src/api/middleware/rate-limit.middleware.ts`):

- `sessionUploadLimitMiddleware` checks `currentUsage + imageCount > 10`
- Correctly enforces the limit, but the limit can never be reclaimed

---

## Impact

- Users are locked out of uploading after reaching 10 images in a session, even after clearing/deleting all images
- The only workaround is waiting 1 hour for session expiry or clearing cookies manually
- Blocks normal workflow: upload → process → clear → upload more

---

## Suggested Fix

**Backend changes (minimal — ~10 lines):**

1. Add `resetUsage(sessionId)` method to `SessionService`:

   ```typescript
   resetUsage(sessionId: string): void {
     const session = this.sessions.get(sessionId);
     if (session) {
       session.imagesProcessed = 0;
       session.lastActivityAt = new Date();
     }
   }
   ```

2. Call it from `/api/cleanup` endpoint in `server.ts`:
   ```typescript
   app.post(
     '/api/cleanup',
     asyncHandler(async (req, res) => {
       const sessionId = req.cookies?.sessionId;
       if (sessionId) services.sessionService.resetUsage(sessionId);
       // ... existing file cleanup
     })
   );
   ```

**Optional frontend enhancement:**

- In `handleImageDelete`, call `cleanup()` when the last image is removed (so the session resets without requiring the user to click "Clear")

---

## Workaround

Until fixed, users can:

- Clear browser cookies to get a fresh session
- Wait 1 hour for session expiry
- Restart the server (clears in-memory sessions)
