# 🐛 BUG REPORT: Story 1.5 Integration Incomplete

**Issue ID:** Story-1.5-Integration-Missing  
**Priority:** HIGH  
**Status:** Story incorrectly marked "done"  
**Discovered By:** Manual smoke testing  
**Date:** 2025-11-22  
**Story:** 1.5 - Remove Cloudinary Dependency

---

## Summary

Story 1.5 is marked as "done" in `docs/sprint-status.yaml:49`, but the `/api/upload` endpoint is NOT using TempUrlService as required by acceptance criteria AC4 and AC6. The endpoint still uses the old prototype code that saves to `uploads/` directory without compression.

---

## Impact

- ❌ Story 1.5 acceptance criteria AC4, AC6, AC9 NOT met
- ❌ Images not compressed (513KB uploaded, should be ~80-100KB)
- ❌ Files saved to wrong directory (`uploads/` not `temp/`)
- ❌ No automatic cleanup (temp files should auto-delete)
- ❌ Cost savings from Story 1.4 NOT realized (compression not happening)
- ❌ Blocks proper testing of Epic 1 foundation

---

## Expected Behavior (Story 1.5 AC6)

From `docs/epics.md` lines 336-343:

**"And the new processing flow should be:"**

1. Receive uploaded image (multer) ✅ Working
2. **Call `tempUrlService.createTempUrl(file)`** → compresses & saves to `/temp/{uuid}.jpg` ❌ **MISSING**
3. Receive public HTTPS URL ❌ **MISSING**
4. Send URL to OpenAI Vision API (happens in `/api/process-image`) ✅ Working
5. Receive metadata ✅ Working
6. Cleanup handled automatically by TempUrlService ❌ **MISSING**
7. Return metadata to client ✅ Working

---

## Actual Behavior

### Current Code (`server.ts` lines 109-133):

```typescript
app.post('/api/upload', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const file = req.file as Express.Multer.File;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // ❌ PROBLEM: Just returns file info from multer
    // ❌ No TempUrlService usage
    // ❌ No compression
    // ❌ Saves to uploads/ not temp/
    const fileInfo: UploadedFile = {
      id: file.filename, // ❌ Timestamp-based, not UUID
      name: file.originalname,
      size: file.size, // ❌ Original size (513KB), not compressed
      path: file.path, // ❌ "uploads/...", not "temp/..."
    };

    res.json({ success: true, file: fileInfo });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : 'Unknown', file: req.file?.originalname },
      'Upload error'
    );
    res.status(500).json({ error: (error as Error).message });
  }
});
```

### Test Evidence:

**Upload request:**

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "image=@reference_images/_MG_0024-2.jpg"
```

**Actual response:**

```json
{
  "success": true,
  "file": {
    "id": "1763812299053-308979922-_MG_0024-2.jpg",
    "name": "_MG_0024-2.jpg",
    "size": 513059, // ❌ Not compressed
    "path": "uploads/1763812299053-308979922-_MG_0024-2.jpg" // ❌ Wrong directory
  }
}
```

**File system check:**

```bash
ls -lh temp/
# total 0  ❌ No files created

ls -lh uploads/
# -rw-r--r--  1 user  staff  501K  1763812299053-308979922-_MG_0024-2.jpg
# ❌ File in wrong location, not compressed
```

---

## Root Cause

The `/api/upload` endpoint (lines 109-133 in `server.ts`) was never updated to use TempUrlService during Story 1.5 implementation. It still uses the old prototype multer configuration that saves directly to `uploads/`.

**Note:** The `/api/process-image` endpoint (lines 137-182) DOES use TempUrlService correctly:

```typescript
// Line 150: Correct usage
const url = await services.tempUrl.createTempUrlFromPath(filePath);
```

But the upload endpoint was not updated, so images never reach the temp/ directory.

---

## Required Fix

### Location: `server.ts` lines 109-133

### Current Code (WRONG):

```typescript
app.post('/api/upload', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const file = req.file as Express.Multer.File;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // ❌ Just returns multer file info
    const fileInfo: UploadedFile = {
      id: file.filename,
      name: file.originalname,
      size: file.size,
      path: file.path,
    };

    res.json({ success: true, file: fileInfo });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : 'Unknown', file: req.file?.originalname },
      'Upload error'
    );
    res.status(500).json({ error: (error as Error).message });
  }
});
```

### Required Code (CORRECT):

```typescript
app.post('/api/upload', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const file = req.file as Express.Multer.File;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    req.log.info({ originalName: file.originalname, size: file.size }, 'Uploading image');

    // ✅ USE TempUrlService (Story 1.5 AC4 & AC6)
    const tempUrl = await services.tempUrl.createTempUrl(file);
    req.log.info({ tempUrl }, 'Created temp URL with compression');

    // Extract UUID from temp URL for response
    // tempUrl format: http://localhost:3000/temp/{uuid}.jpg
    const uuid = tempUrl.split('/temp/')[1]?.replace('.jpg', '');

    // ✅ Return temp URL info (not uploads/ path)
    const fileInfo: UploadedFile = {
      id: uuid, // ✅ UUID instead of timestamp
      name: file.originalname,
      size: file.size, // Original size (for reference)
      path: `temp/${uuid}.jpg`, // ✅ Temp directory
      tempUrl: tempUrl, // ✅ Public accessible URL
    };

    // Clean up original upload from multer (already compressed to temp/)
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    res.json({ success: true, file: fileInfo });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : 'Unknown', file: req.file?.originalname },
      'Upload error'
    );
    res.status(500).json({ error: (error as Error).message });
  }
});
```

### Key Changes:

1. **Call TempUrlService** (line 150 equivalent):

   ```typescript
   const tempUrl = await services.tempUrl.createTempUrl(file);
   ```

2. **Return temp URL info** instead of uploads/ path

3. **Clean up original multer file** (since TempUrlService creates compressed version)

4. **Use UUID** extracted from temp URL as file ID

---

## Testing Instructions

After applying the fix, verify with these tests:

### Test 1: Upload and Verify Compression

```bash
# Upload image
curl -X POST http://localhost:3000/api/upload \
  -F "image=@reference_images/_MG_0024-2.jpg" \
  | jq '.'

# Expected response:
# {
#   "success": true,
#   "file": {
#     "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",  // ✅ UUID
#     "name": "_MG_0024-2.jpg",
#     "size": 513059,  // Original size (for reference)
#     "path": "temp/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg",  // ✅ temp/ directory
#     "tempUrl": "http://localhost:3000/temp/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg"
#   }
# }
```

### Test 2: Verify File Location and Compression

```bash
# Check temp directory (should have compressed file)
ls -lh temp/
# Expected: -rw-r--r--  1 user  staff   80K ... {uuid}.jpg  ✅

# Check file size (should be ~80-100KB, compressed from 513KB)
du -h temp/*.jpg
# Expected: 80K-100K  ✅ (80%+ compression)

# Verify uploads directory is empty or file cleaned up
ls -lh uploads/
# Expected: empty or file removed after compression  ✅
```

### Test 3: Verify Temp URL Accessible

```bash
# Get temp URL from upload response
TEMP_URL="http://localhost:3000/temp/{uuid-from-response}.jpg"

# Test accessibility
curl -I $TEMP_URL
# Expected: HTTP/1.1 200 OK  ✅
```

### Test 4: Verify Automatic Cleanup

```bash
# Upload image
curl -X POST http://localhost:3000/api/upload \
  -F "image=@reference_images/_MG_0024-2.jpg"

# Check file exists immediately
ls -lh temp/
# Should show compressed file  ✅

# Wait 15 seconds (default cleanup is 10 seconds)
sleep 15

# Check file auto-deleted
ls -lh temp/
# Expected: total 0 (file cleaned up automatically)  ✅
```

### Test 5: Verify Integration with Process Endpoint

```bash
# 1. Upload image
RESPONSE=$(curl -s -X POST http://localhost:3000/api/upload \
  -F "image=@reference_images/_MG_0024-2.jpg")

# Extract file ID
FILE_ID=$(echo $RESPONSE | jq -r '.file.id')
FILE_NAME=$(echo $RESPONSE | jq -r '.file.name')

# 2. Process image (should still work with new temp/ location)
curl -X POST http://localhost:3000/api/process-image \
  -H "Content-Type: application/json" \
  -d "{\"fileId\":\"$FILE_ID\",\"filename\":\"$FILE_NAME\"}"

# Expected: Metadata returned successfully  ✅
```

---

## Acceptance Criteria Validation

After fix, verify Story 1.5 acceptance criteria are met:

- [ ] **AC1:** Delete `src/cloudinary.ts` file ✅ Already done
- [ ] **AC2:** Uninstall Cloudinary npm package ✅ Already done
- [ ] **AC3:** Remove Cloudinary environment variables ✅ Already done
- [ ] **AC4:** Update image processing code to use TempUrlService ❌ **FIX REQUIRED**
- [ ] **AC5:** Remove all Cloudinary import statements ✅ Already done
- [ ] **AC6:** New processing flow: upload → compress → temp URL → OpenAI ❌ **FIX REQUIRED**
- [ ] **AC7:** Zero external API calls except OpenAI ✅ Already working
- [ ] **AC8:** Processing speed improvement ⏸️ Can't verify until AC4/AC6 fixed
- [ ] **AC9:** All existing functionality should still work ❌ **FIX REQUIRED**

---

## Additional Notes

### Why This Wasn't Caught by Tests

- ✅ **Unit tests pass:** TempUrlService works correctly in isolation (32 tests)
- ❌ **Integration tests missing:** No test validates `/api/upload` uses TempUrlService
- ❌ **Manual testing revealed:** Actual endpoint behavior doesn't match acceptance criteria

**Recommendation:** Add integration test after fix:

```typescript
// tests/server.integration.test.ts
describe('POST /api/upload', () => {
  it('should use TempUrlService and compress images', async () => {
    const response = await request(app)
      .post('/api/upload')
      .attach('image', 'reference_images/_MG_0024-2.jpg');

    expect(response.body.file.path).toContain('temp/');
    expect(response.body.file.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format

    // Verify compressed file exists
    const tempFile = path.join('temp', `${response.body.file.id}.jpg`);
    expect(fs.existsSync(tempFile)).toBe(true);

    // Verify compression (should be <100KB from ~500KB)
    const stats = fs.statSync(tempFile);
    expect(stats.size).toBeLessThan(100 * 1024); // <100KB
  });
});
```

---

## Related Files

- **Bug Location:** `server.ts` lines 109-133
- **Working Example:** `server.ts` lines 150 (process-image endpoint uses TempUrlService correctly)
- **Service to Use:** `src/services/temp-url.service.ts`
- **Acceptance Criteria:** `docs/epics.md` lines 307-362
- **Sprint Status:** `docs/sprint-status.yaml` line 49 (incorrectly marked "done")

---

## Definition of Done

Story 1.5 can be marked "done" when:

1. ✅ `/api/upload` endpoint uses TempUrlService
2. ✅ Images compressed to ~80-100KB
3. ✅ Files saved to `temp/` directory with UUID filenames
4. ✅ Original multer uploads cleaned up
5. ✅ Temp URLs returned in response
6. ✅ Automatic cleanup works (files deleted after 10 seconds)
7. ✅ All 5 manual tests pass (see Testing Instructions above)
8. ✅ Integration test added to prevent regression
9. ✅ No Cloudinary code remains anywhere
10. ✅ Existing `/api/process-image` functionality still works

---

## Estimated Fix Time

**2-3 hours** including:

- Code update: 30 minutes
- Testing: 1 hour
- Integration test: 30 minutes
- Documentation update: 30 minutes
- Final verification: 30 minutes

---

## Priority Justification

**HIGH Priority** because:

- Blocks Epic 1 completion and Epic 2 start
- Affects cost savings claim (compression not happening)
- Story marked "done" but doesn't meet acceptance criteria
- Found during manual testing, would impact production

---

**Status:** Ready for developer assignment  
**Assigned To:** [Developer Name]  
**Target Fix Date:** [Date]

---

<!-- Bug Report Generated: 2025-11-22 -->
<!-- Test Architect: Murat (TEA) -->
