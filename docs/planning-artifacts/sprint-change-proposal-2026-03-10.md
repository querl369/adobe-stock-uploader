# Sprint Change Proposal — Epic 5 Story Rewrite

**Date:** 2026-03-10
**Triggered by:** Sprint planning for Epic 5 (User Interface & Experience)
**Scope:** Minor — story-level rewrite within existing epic structure
**Status:** Approved

---

## Section 1: Issue Summary

Epic 5's 7 stories (5.1–5.7) were authored during initial planning before the existing React prototype in `client/src/app.tsx` was audited. The stories describe building UI components from scratch — new files, new libraries (react-dropzone, Framer Motion), greenfield acceptance criteria — when a functional prototype already covers ~60-70% of the described functionality.

This mismatch would cause implementation confusion: developers wouldn't know which acceptance criteria are "already done" vs "actually needed," and the stories prescribe libraries that conflict with what's already installed (react-dnd vs react-dropzone).

**Discovery context:** Identified while preparing to context Epic 5 for sprint planning. Comparison of planned stories against existing `client/src/app.tsx` revealed pervasive overlap.

**Evidence:**

- Drag-and-drop already implemented with react-dnd (stories specify react-dropzone)
- Thumbnail grid with 4-column layout and delete buttons exists
- Progress bar with 2-second polling of `/api/batch-status/:batchId` exists
- CSV download integrated with backend endpoints
- Dark mode CSS variables defined in index.css with oklch() color space
- Custom animations (grain texture, lava lamp button) already styled
- Error handling uses alert() — functional but crude
- Entire UI is one monolithic app.tsx (~500 lines) — no component decomposition

---

## Section 2: Impact Analysis

### Epic Impact

- **Epic 5:** Stories 5.1–5.7 require full rewrite of descriptions and acceptance criteria. Epic goal and title remain valid.
- **Epic 6 (User Accounts):** No direct impact. Benefits from component architecture established in rewritten Epic 5.
- **Epics 1–4:** Complete and verified. No impact.

### Story Impact

All 7 stories rewritten from greenfield to integration-focused:

| Story | Old Title (Greenfield)                  | New Title (Integration)                    |
| ----- | --------------------------------------- | ------------------------------------------ |
| 5.1   | Landing Page & Hero Section             | Component Architecture & App Decomposition |
| 5.2   | Drag-and-Drop Upload Interface          | Upload Experience & File Validation        |
| 5.3   | Processing Progress Visualization       | Processing View & Real-Time Status         |
| 5.4   | Success Screen & Download               | Results View & Metadata Preview            |
| 5.5   | Dark Mode Theme & Visual Polish         | Dark Mode Default & Visual Polish          |
| 5.6   | Responsive Design & Mobile Optimization | Responsive Design & Mobile Optimization    |
| 5.7   | Error States & User Feedback            | Error Handling & Toast Notifications       |

### Artifact Conflicts

- **PRD:** No changes needed. MVP goals unchanged.
- **Architecture docs:** No changes needed. Describe correct target state.
- **UX specs:** No changes needed. Stories bridge current → target.
- **Sprint status:** No structural changes. Story IDs preserved, all remain `backlog`.
- **Story files:** None drafted yet — all in `backlog`. No files to update.

### Technical Impact

- No code changes required by this proposal
- No infrastructure or deployment changes
- Reduced implementation scope (integration vs greenfield)

---

## Section 3: Recommended Approach

**Selected: Direct Adjustment — rewrite 7 story descriptions in `docs/epics.md`**

### Rationale

1. **Minimal disruption** — no completed work affected, no architectural changes
2. **No story files drafted yet** — all 7 stories are `backlog`, no files in `docs/stories/`
3. **Single document edit** — changes confined to `docs/epics.md`
4. **Reduced scope** — recognizing existing work makes Epic 5 smaller than planned
5. **Planning artifacts stay valid** — PRD, architecture, UX docs all describe correct target

### Alternatives Considered

- **Rollback:** Not viable. No completed work to revert. Existing prototype is an asset, not a problem.
- **MVP Review:** Not needed. MVP is more achievable now, not less.
- **Add notes to existing stories:** Rejected. Acceptance criteria fundamentally assume nothing exists; patching with "skip if done" notes would be confusing.
- **Reduce to fewer stories:** Rejected. 7 stories at reduced scope keeps work incremental and reviewable.

### Effort & Risk

- **Effort:** Low — rewriting story descriptions in one file
- **Risk:** Low — no code changes, no architectural shifts
- **Timeline impact:** Positive — Epic 5 is smaller than originally estimated

---

## Section 4: Detailed Change Proposals

### Story 5.1: Component Architecture & App Decomposition

**Old:** Build landing page and hero section from scratch (LandingPage.tsx, react-dropzone, Framer Motion)

**New:** Decompose monolithic app.tsx into focused components (UploadView, ProcessingView, ResultsView, AppHeader, AppFooter) with a shared API client layer and typed interfaces. No visual changes — pure refactoring to establish clean architecture for subsequent stories.

**Key changes:**

- Extract 5 components from app.tsx
- Create `client/src/api/` module replacing inline fetch() calls
- Create `client/src/types/` for shared interfaces
- Preserve all existing functionality and react-dnd

---

### Story 5.2: Upload Experience & File Validation

**Old:** Build drag-and-drop upload interface from scratch (react-dropzone, UploadZone.tsx, Canvas API thumbnails)

**New:** Add file validation UI (type/size/count errors as inline messages), upload zone metadata display (file count, total size), and thumbnail polish (file info, smooth animations). Preserve existing react-dnd, thumbnails, and delete functionality.

**Key changes:**

- Replace alert() validation with inline error messages
- Add file count and total size display
- Add CSS transitions for thumbnail appearance

---

### Story 5.3: Processing View & Real-Time Status

**Old:** Build processing progress visualization from scratch (ProcessingView.tsx, useEffect polling, Framer Motion)

**New:** Add per-image status indicators (completed/processing/failed/pending icons), time estimates, processing speed, and smooth transitions. Wire up backend data already returned by batch-status API but currently ignored by frontend.

**Key changes:**

- Per-image status overlays using lucide-react icons
- ETA and speed display from existing API response fields
- CSS transitions for smooth progress (not Framer Motion)
- Auto-transition to results view on completion

---

### Story 5.4: Results View & Metadata Preview

**Old:** Build success screen from scratch (SuccessView.tsx, confetti animation, metadata preview table)

**New:** Add metadata preview table (thumbnail, filename, title, keywords, category), results summary banner, toast notifications on download, "Process More" flow, and batch history integration with Epic 4.3 backend API.

**Key changes:**

- Metadata preview table using shadcn/ui Table
- Sonner toast notifications (already installed, unused)
- Batch history section consuming `GET /api/batches`
- Move initials input to results view

---

### Story 5.5: Dark Mode Default & Visual Polish

**Old:** Build dark theme from scratch (Tailwind dark mode config, custom color palette, referencing Lightroom/Capture One)

**New:** Make dark mode the default (add `dark` class by default, persist to localStorage), add sun/moon toggle in header, audit oklch() variables for WCAG AA contrast, and do a consistency pass on spacing/borders/hover states. Preserve existing grain texture and lava lamp animations.

**Key changes:**

- Dark mode toggle with localStorage persistence
- WCAG AA contrast audit and fixes
- Visual consistency pass across all components

---

### Story 5.6: Responsive Design & Mobile Optimization

**Old:** Build responsive design from scratch (breakpoints, touch targets, 3G optimization, PWA, real device testing)

**New:** Audit and fix breakpoints for tablet (3-column grid) and mobile (single column, 2-column grid). Ensure 44px touch targets, mobile-friendly upload text, and responsive metadata table. Use Chrome DevTools emulation — no real device testing or PWA features in MVP.

**Key changes:**

- Breakpoint-specific grid columns for thumbnails
- Touch target size compliance
- Mobile-specific upload zone text
- Responsive metadata preview table

---

### Story 5.7: Error Handling & Toast Notifications

**Old:** Build error system from scratch (error constants file, Sentry, toast, inline validation, modals, error boundary)

**New:** Replace all alert() calls with Sonner toast notifications, add React error boundary, implement loading states (button spinners, disabled states during async ops). No Sentry, no modals, no separate error constants file.

**Key changes:**

- Wire up Sonner toast (already installed)
- Replace every alert() with appropriate toast
- React error boundary (~30 lines)
- Loading/disabled states during async operations

---

## Section 5: Implementation Handoff

### Scope Classification: Minor

This is a planning document update directly implementable by the development team.

### Handoff

| Role                     | Responsibility                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **SM (Scrum Master)**    | Update `docs/epics.md` with rewritten story descriptions. Context Epic 5 via sprint planning workflow. Draft stories via create-story workflow. |
| **Dev team**             | Implement stories 5.1–5.7 via normal dev-story → code-review cycle                                                                              |
| **No escalation needed** | Scope unchanged, only story-level framing corrected                                                                                             |

### Workflow Sequence

1. ✅ `/bmad-bmm-correct-course` — this workflow (complete)
2. `/bmad-bmm-sprint-planning` — context Epic 5, plan sprint
3. `/bmad-bmm-create-story` — draft each story (5.1 first, then sequential)
4. `/bmad-bmm-dev-story` — implement each story
5. `/bmad-bmm-code-review` — review each implementation
6. Repeat 3–5 for stories 5.2–5.7
7. `/bmad-bmm-retrospective` — Epic 5 retrospective (optional)

### Success Criteria

- All 7 stories in `docs/epics.md` reflect integration/refactoring scope
- Story 5.1 establishes component architecture enabling parallel work on 5.2–5.7
- No existing functionality regresses during Epic 5 implementation
- Frontend decomposed from monolith into maintainable components
- All alert() calls replaced with toast notifications
- Dark mode works as default with toggle
