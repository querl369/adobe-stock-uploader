# Epic 2: Anonymous Image Processing Pipeline - Ready for Development

**Status:** Ready for Development  
**Date Prepared:** November 23, 2025  
**Prepared By:** Bob (Scrum Master)  
**For:** Development Team

---

## 🚀 Epic Overview

**Goal:** Enable the core value proposition - users can try the tool immediately by processing up to 10 images without creating an account.

**Business Value:** Zero friction trial builds trust and drives conversion. This is the primary competitive differentiator.

**Prerequisites:** ✅ Epic 1 COMPLETED (Production-ready foundation established)

---

## 📋 Stories Ready for Development (6 Stories)

All Epic 2 stories have been marked `ready-for-dev` and can be implemented immediately. Each story includes detailed acceptance criteria, technical notes, and implementation guidance in `docs/epics.md`.

### Story 2.1: Batch Upload API Endpoint

**Priority:** HIGH - Foundation for entire epic  
**Estimated Time:** 3-4 hours  
**Prerequisites:** Epic 1 Stories 1.6 (error handling)

**Key Deliverables:**

- `/api/upload-images` endpoint (POST)
- Accept 1-10 images (JPG, PNG, WEBP)
- Max 50MB per file validation
- Cookie-based session tracking for anonymous users
- Error handling (400 for invalid files, 429 for rate limits)

**Technical Approach:**

- Create `src/api/routes/upload.routes.ts`
- Use `multer` for multipart handling
- Implement file validation middleware
- Session tracking for anonymous users

**Reference:** See `docs/epics.md` → Story 2.1 for complete acceptance criteria

---

### Story 2.2: Cookie-Based Anonymous Session Tracking

**Priority:** HIGH - Required for rate limiting  
**Estimated Time:** 2-3 hours  
**Prerequisites:** Story 2.1

**Key Deliverables:**

- Secure HTTP-only session cookies
- Session tracking (images processed, timestamps)
- In-memory session store (MVP)
- Automatic session expiry (1 hour)
- User feedback: "X of 10 free images used"

**Technical Approach:**

- Use `cookie-parser` middleware
- Create `src/services/session.service.ts`
- Implement session cleanup job (every 10 minutes)
- Store sessions in Map (in-memory for MVP)

**Reference:** See `docs/epics.md` → Story 2.2 for complete acceptance criteria

---

### Story 2.3: Rate Limiting Middleware

**Priority:** HIGH - Prevent abuse  
**Estimated Time:** 2 hours  
**Prerequisites:** Story 2.2

**Key Deliverables:**

- Anonymous users: 10 images per IP per hour
- Free users: 100 images per month (database tracked)
- Per-IP rate limit: 50 requests per minute
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- 429 error with clear message when limit exceeded

**Technical Approach:**

- Create `src/api/middleware/rate-limit.middleware.ts`
- Use `express-rate-limit` or custom implementation
- Store rate limit data in memory (Map)
- Use IP address + session ID as rate limit key

**Reference:** See `docs/epics.md` → Story 2.3 for complete acceptance criteria

---

### Story 2.4: Image Compression Service

**Priority:** MEDIUM - Performance optimization  
**Estimated Time:** 2 hours  
**Prerequisites:** Epic 1 Story 1.4 (TempUrlService), Story 2.1

**Key Deliverables:**

- Resize to max 1024px dimension (maintain aspect ratio)
- Convert to JPEG format (85% quality)
- Progressive JPEG optimization
- Target: <500KB average compressed size
- Target: <1 second compression time
- Delete original after compression

**Technical Approach:**

- Use Sharp library (already available from Epic 1)
- Create `src/services/image-processing.service.ts`
- Handle various input formats (PNG transparency → white background)
- Add error handling for corrupted images

**Reference:** See `docs/epics.md` → Story 2.4 for complete acceptance criteria

---

### Story 2.5: Parallel Processing Orchestration

**Priority:** HIGH - Core performance feature  
**Estimated Time:** 4-5 hours  
**Prerequisites:** Story 2.4, Epic 1 Story 1.4 (temp URLs)

**Key Deliverables:**

- 5 concurrent processes maximum (using `p-limit`)
- Process flow: compress → temp URL → OpenAI API → cleanup
- Failed images don't block others (graceful degradation)
- Target: 40-60 seconds for 10 images
- 3-4x faster than sequential processing
- Memory management and resource cleanup

**Technical Approach:**

- Install `p-limit` package
- Create `src/services/batch-processing.service.ts`
- Implement retry logic (1 retry on failure)
- Add timeout wrapper (30s per image)
- Track processing state (pending, processing, completed, failed)

**Reference:** See `docs/epics.md` → Story 2.5 for complete acceptance criteria

---

### Story 2.6: Processing Status & Progress Tracking

**Priority:** MEDIUM - User experience enhancement  
**Estimated Time:** 3 hours  
**Prerequisites:** Story 2.5

**Key Deliverables:**

- `GET /api/batch-status/:batchId` endpoint
- Real-time progress updates (total, completed, failed, processing, pending)
- Estimated time remaining calculation
- Client polling every 2 seconds
- Batch state storage (in-memory for MVP)
- Automatic cleanup after 1 hour of completion

**Technical Approach:**

- Create status endpoint in `src/api/routes/batch.routes.ts`
- Store batch state in memory (Map) or Redis (future)
- Update state as each image completes
- Calculate ETA based on average processing time

**Reference:** See `docs/epics.md` → Story 2.6 for complete acceptance criteria

---

## 📚 Essential Reading for Developers

Before starting Epic 2 development, review these documents:

1. **Epic Specifications:** `docs/epics.md` → Epic 2 section
   - Complete acceptance criteria for all stories
   - Technical notes and implementation guidance
   - Prerequisites and dependencies

2. **Architecture Foundation:** `docs/ARCHITECTURE_REFACTORING_GUIDE.md`
   - Understand the service layer pattern from Epic 1
   - Review error handling and typed errors
   - Check dependency injection container usage

3. **Sprint Status:** `docs/sprint-status.yaml`
   - Current story status tracking
   - Epic 1 completion notes and lessons learned

4. **PRD Reference:** `docs/PRD.md`
   - Business requirements context
   - User personas and use cases

---

## 🎯 Implementation Sequence (Recommended)

**Critical Path:** Stories must be implemented in this order due to dependencies.

```
Story 2.1 (Upload Endpoint)
    ↓
Story 2.2 (Session Tracking)
    ↓
Story 2.3 (Rate Limiting)
    ↓
Story 2.4 (Image Compression)
    ↓
Story 2.5 (Parallel Processing) ← Core processing flow
    ↓
Story 2.6 (Status Tracking)
```

**Estimated Timeline:** 3-4 development days for complete epic

---

## ✅ Definition of Done (Per Story)

Before marking a story as "done", ensure:

- [ ] All acceptance criteria met (Given/When/Then)
- [ ] Code follows Epic 1 architecture patterns (service layer, DI, typed errors)
- [ ] Unit tests written and passing
- [ ] Integration tests for API endpoints
- [ ] Error handling implemented (no silent failures)
- [ ] Logging added (structured logging with Pino)
- [ ] Code reviewed (if team process requires)
- [ ] Manual testing completed
- [ ] No regression (Epic 1 features still work)
- [ ] Documentation updated (if needed)
- [ ] Sprint status updated: ready-for-dev → in-progress → review → done

---

## 🔄 Development Workflow

1. **Start Story:**
   - Load DEV agent: `@dev.mdc`
   - Run: `*dev-story` workflow
   - Select Epic 2 story to implement
   - Update sprint-status.yaml: `ready-for-dev` → `in-progress`

2. **During Development:**
   - Follow architecture patterns from Epic 1
   - Use service layer and dependency injection
   - Implement typed errors (not silent failures)
   - Add structured logging with Pino
   - Write unit tests as you go

3. **Complete Story:**
   - Run all tests (unit + integration)
   - Manual testing of feature
   - Code review (optional)
   - Update sprint-status.yaml: `in-progress` → `review` → `done`

4. **Code Review:**
   - Run: `*code-review` workflow with SM
   - Address feedback
   - Mark as `done` when approved

---

## 🚨 Important Notes

### Fast-Track Approach

Epic 2 stories were fast-tracked from `backlog` → `ready-for-dev` without individual story file creation. This means:

- ✅ **Faster start:** Developers can begin immediately
- ⚠️ **No story files:** Work directly from epic specifications in `docs/epics.md`
- ⚠️ **No SM pre-review:** Story details come directly from PM (epic file)

### Leverage Epic 1 Foundation

Epic 2 implementation should heavily leverage the production-ready foundation from Epic 1:

- **Service Layer:** Use dependency injection pattern
- **Error Handling:** Use typed error classes (ValidationError, ProcessingError, etc.)
- **Logging:** Use Pino structured logging (no console.log)
- **Retry Logic:** Use `withRetry()` utility for resilience
- **Metrics:** Increment Prometheus metrics for processing
- **Configuration:** Use config service for all settings

### Testing Strategy

- **Unit Tests:** Test each service method independently
- **Integration Tests:** Test API endpoints with actual HTTP requests
- **Manual Testing:** Test upload flow end-to-end
- **Load Testing:** Verify 5 concurrent image processing works
- **Error Cases:** Test rate limits, invalid files, failed processing

---

## 📞 Questions or Issues?

**For Story Clarifications:**

- Reference `docs/epics.md` → Epic 2 section
- Load SM agent: `@sm.mdc`
- Ask specific questions about acceptance criteria

**For Technical Guidance:**

- Reference Epic 1 implementation patterns
- Review `docs/ARCHITECTURE_REFACTORING_GUIDE.md`
- Check existing service implementations in `src/services/`

**For Architecture Decisions:**

- Load Architect agent: `@architect.mdc`
- Run: `*architecture` workflow

---

## 🎉 Success Criteria for Epic 2

Epic 2 will be considered complete when:

1. ✅ All 6 stories implemented and tested
2. ✅ Anonymous users can upload 1-10 images without signup
3. ✅ Images processed in parallel (5 concurrent, 40-60s for 10 images)
4. ✅ Rate limiting prevents abuse (10 images per anonymous session)
5. ✅ Real-time progress tracking works
6. ✅ All error cases handled gracefully
7. ✅ Unit tests pass (target: >90% coverage)
8. ✅ Integration tests pass (all endpoints)
9. ✅ Manual end-to-end testing completed
10. ✅ No regression in Epic 1 functionality

**Next Epic:** After Epic 2 completion, proceed to Epic 3 (AI Metadata Generation Engine)

---

**Document Created:** November 23, 2025  
**Last Updated:** November 23, 2025  
**Status:** Epic 2 ready for immediate development  
**Prepared By:** Bob (Scrum Master)
