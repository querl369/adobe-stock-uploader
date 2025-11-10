# Adobe Stock Uploader - Product Requirements Document

**Author:** Alex  
**Date:** November 10, 2025  
**Version:** 1.0

---

## Executive Summary

Adobe Stock Uploader is a web-based SaaS application that automates the tedious process of generating metadata (titles, keywords, categories) for stock photography submissions to Adobe Stock. Using AI-powered vision analysis, the tool processes images in batch, generates Adobe Stock-compliant metadata, and exports results as CSV files ready for upload.

The product targets individual stock photographers who manually process hundreds of images monthly, replacing hours of manual data entry with a 3-minute automated workflow.

### What Makes This Special

**Speed as a Competitive Moat** - While competitors require signup walls and offer limited free tiers, Adobe Stock Uploader lets users try immediately without registration, processes 3-4x faster than alternatives through parallel processing, and offers 10x more generous free tier (100 images/month). The magic moment: "Drop your images, get perfect Adobe Stock metadata in under 3 minutes—no signup required."

**Simplicity in a Feature-Bloated Market** - Stock photographers are visual creatives who value speed and simplicity over feature complexity. Where competitors add endless features, we win by removing friction. The experience is "stupidly simple": Drop images → See progress → Download CSV. That's it.

---

## Project Classification

**Technical Type:** Full-Stack Web Application (SaaS)  
**Domain:** Creative Tools / Digital Asset Management  
**Complexity:** Level 2 (Standard Web Application)

### Technical Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Express 4, Node.js, TypeScript
- **Image Processing:** Sharp (compression, optimization)
- **AI:** OpenAI GPT-5-mini Vision API
- **Deployment:** Railway/Render/Fly.io (free HTTPS)
- **Database:** PostgreSQL (for user accounts, usage tracking)

### Project Track

**BMad Method Track** - Standard web application following full planning → architecture → implementation workflow.

---

## Success Criteria

### MVP Success (2 Weeks Post-Launch)

- ✅ **Processing Speed:** Average <2 seconds per image (3-4x faster than competitors)
- ✅ **Cost Structure:** Zero per-image external costs (self-hosted architecture)
- ✅ **User Experience:** 100% of test users can process images without signup
- ✅ **Quality:** UI scores 8+/10 on "ease of use" rating
- ✅ **Metadata Accuracy:** AI generates accurate, Adobe Stock-compliant metadata

### 30-Day Goals (Post-Public Launch)

- **Adoption:** 100 anonymous trial users
- **Conversion:** 20 free account signups
- **Revenue:** 5 paid conversions
- **Reliability:** <5% error rate in processing
- **Satisfaction:** Positive user testimonials and feedback

### Business Metrics

**Primary Metrics:**

- **Trial-to-Signup Conversion:** Target 10-20%
- **Free-to-Paid Conversion:** Target 5-10%
- **Processing Volume:** Track images processed per user
- **Customer Acquisition Cost:** Minimize through viral "try-first" model

**Secondary Metrics:**

- **Time-to-Value:** First CSV download within 3 minutes of landing
- **Retention:** Monthly active users returning
- **NPS Score:** Target 50+ (promoters vs detractors)

---

## Product Scope

### MVP - Minimum Viable Product (2-Week Sprint)

**Core Functionality:**

1. **Anonymous Processing** - 10 images per session, no signup required
2. **Batch Upload** - Drag-and-drop interface for multiple images
3. **AI Metadata Generation** - Title, keywords (up to 50), category selection
4. **CSV Export** - Adobe Stock-compliant format, instant download
5. **User Accounts** - Optional free account (100 images/month, history)
6. **Self-Hosted Architecture** - Temp URLs for image processing (no Cloudinary)
7. **Parallel Processing** - 5 concurrent processes for 3-4x speed boost
8. **Simple Progress Bar** - Basic feedback during processing
9. **Elegant UI** - Dark mode, clean typography, photographer aesthetic

**Technical Optimizations (MVP):**

- Thumbnail compression (1024px, 85% quality)
- UUID-based temp file serving (4-6 second lifetime)
- GPT-5o-mini with optimized prompts (temperature: 0.3, max_tokens: 500)
- Cookie-based abuse prevention for anonymous users

### Growth Features (Post-MVP, 1-2 Months)

**Enhanced Processing:**

- Real-time progress with Server-Sent Events (SSE)
- Full processing dashboard with queue visualization
- Retry individual failed images
- Cancel processing mid-batch
- Estimated time remaining (ETA)

**User Features:**

- Batch history management
- Download previous CSVs
- Save favorite keyword sets
- Bulk keyword editing
- Export format options (JSON, TXT)

**Additional Modes:**

- Social media caption generator (Instagram/Twitter)
- SEO optimizer (alt-text, filenames, descriptions)

**Pricing & Monetization:**

- Stripe payment integration
- Multiple subscription tiers
- Pay-per-use option (potential)

### Vision (Future, 6+ Months)

**Agency Features:**

- Multi-user team accounts
- Photographer management
- Bulk operations (1,000s of images)
- API access for integrations

**Platform Expansion:**

- E-commerce product description generator
- Direct Adobe Stock integration (skip CSV)
- Mobile app (iOS/Android)
- Multi-AI ensemble (OpenAI + Claude + Gemini voting)
- Bring-Your-Own-API-Key (BYOK) option

---

## Web Application Specific Requirements

### Architecture Pattern

**Monolithic Full-Stack** for MVP simplicity, with clear separation for future microservices:

- Frontend SPA (React) communicating via REST API
- Backend Express server handling uploads, AI orchestration, and CSV generation
- Stateless processing (enables horizontal scaling)

### API Structure

#### Core Endpoints

**POST /api/upload-images**

- **Purpose:** Process batch of images and generate metadata
- **Input:** multipart/form-data with image files
- **Process:**
  1. Receive and validate files (max 10 for anonymous, 100 for free tier)
  2. Compress with Sharp (1024px, 85% quality JPEG)
  3. Save to /temp/{uuid}.jpg
  4. Generate public URL
  5. Send to OpenAI Vision API (5 parallel)
  6. Receive metadata (title, keywords, category)
  7. Delete temp file
  8. Return JSON response with metadata array
- **Output:** JSON with metadata for all images
- **Rate Limit:** Cookie-based for anonymous, account-based for users

**POST /api/generate-csv**

- **Purpose:** Convert metadata to Adobe Stock CSV format
- **Input:** JSON metadata array
- **Output:** CSV file download

**POST /api/auth/signup** (Future)

- User registration with email/password
- Email verification
- Create user account with free tier

**POST /api/auth/login** (Future)

- JWT-based authentication
- Session management

**GET /api/usage** (Future)

- Get user's monthly usage stats
- Images processed, remaining quota

### Authentication Model

**MVP: Cookie-Based Anonymous + Optional Accounts**

- **Anonymous Users:** Browser cookie tracks session, prevents spam
- **Free Accounts:** Email/password authentication, JWT tokens
- **Paid Accounts:** Same as free + Stripe customer ID

**Security:**

- HTTPS-only cookies
- CSRF protection
- Rate limiting per IP and per user
- Input validation (file types, sizes, counts)

---

## User Experience Principles

### Design Philosophy: "Stupidly Simple"

Stock photographers are visual creatives who value:

- **Speed** - Don't waste their time
- **Clarity** - No confusion about what to do
- **Elegance** - Design quality signals tool quality
- **Trust** - Professional aesthetic builds confidence

### Visual Personality

**Inspiration:** Adobe Lightroom, Capture One (professional photo editing tools)

**Characteristics:**

- **Dark Mode Primary** - Mimics photo editing environments
- **Clean Sans-Serif** - Inter or SF Pro typography
- **Generous Whitespace** - Reduces cognitive load
- **Muted Professional Colors** - Not bright/playful, but sophisticated
- **Large Image Previews** - Visual people need to see their work
- **Subtle Animations** - Smooth, purposeful (not gimmicky)

### Key Interactions

#### Landing Page → Upload

```
Hero Section:
  - H1: "Generate Adobe Stock Metadata with AI"
  - Large drag-and-drop zone (prominent, inviting)
  - Subtext: "No signup required • 100 free images/month"
  - Visual: Animated example of drag-drop → CSV

CTA:
  - Primary: Drag-drop zone
  - Secondary: "How it works" (optional)
```

#### Processing Flow

```
Upload Complete:
  ↓
Simple Progress Bar:
  "Processing 3 of 10 images..."
  [████████░░░░░░] 60%

No clutter, no distractions
User can see but not interrupt (MVP)
```

#### Completion → Download

```
Success State:
  ✅ "All images processed!"
  [Download CSV] (large, prominent button)

  Subtle upsell below:
  "Want to save history and process 100 free images/month?"
  [Create Free Account] (smaller, non-intrusive)
```

#### Critical UX Flow: "Try First, Sign Up Later"

**The Magic of Zero Friction:**

```
User lands → No signup wall!
         ↓
Drop 10 images → Immediate processing
         ↓
2-3 minutes → Download CSV
         ↓
"Wow, that worked!" → Trust established
         ↓
"Want more?" → Signup feels like unlock, not barrier
```

**Competitive Advantage:** MetaPhotoAI requires signup FIRST. We let users experience value BEFORE asking for commitment.

---

## Functional Requirements

### FR-1: Anonymous Image Processing

**Priority:** Critical (MVP)  
**User Story:** As a new visitor, I want to process up to 10 images without creating an account, so I can evaluate the tool immediately.

**Acceptance Criteria:**

- User can drag-and-drop or click to upload 1-10 images
- Supported formats: JPG, PNG, WEBP (max 50MB each)
- Processing happens immediately without signup
- CSV download available within 3 minutes average
- Cookie prevents same browser from processing >10 images per session
- User sees clear message: "Want more? Create free account"

**Domain Context:** Instant value delivery builds trust with photographers skeptical of new tools.

---

### FR-2: Batch Image Upload

**Priority:** Critical (MVP)  
**User Story:** As a photographer, I want to upload multiple images at once, so I can process my entire shoot efficiently.

**Acceptance Criteria:**

- Drag-and-drop interface accepts multiple files
- Visual feedback shows all uploaded files (thumbnails)
- File validation before upload (type, size)
- Clear error messages for invalid files
- Remove individual files before processing
- Upload limit enforcement (10 anonymous, 100 free tier)

---

### FR-3: AI Metadata Generation

**Priority:** Critical (MVP)  
**User Story:** As a photographer, I want AI to analyze my images and generate accurate Adobe Stock metadata, so I don't have to manually write titles and keywords.

**Acceptance Criteria:**

- Each image analyzed by OpenAI Vision API (GPT-5-mini)
- Generated metadata includes:
  - Title (descriptive, 50-200 characters)
  - Keywords (30-50 relevant terms)
  - Category (Adobe Stock category taxonomy)
- AI prompt optimized for accuracy (temperature: 0.3)
- Metadata follows Adobe Stock guidelines
- Processing handles various subjects (landscapes, portraits, abstract, etc.)

**Technical Constraint:** Must use public HTTPS URLs for OpenAI (self-hosted temp files)

---

### FR-4: Adobe Stock CSV Export

**Priority:** Critical (MVP)  
**User Story:** As a photographer, I want to download metadata as a CSV file formatted for Adobe Stock, so I can upload it directly without reformatting.

**Acceptance Criteria:**

- CSV format matches Adobe Stock requirements exactly
- Columns: Filename, Title, Keywords, Category
- Keywords comma-separated within cell
- CSV encoding: UTF-8
- One-click download button
- Filename: `adobe-stock-metadata-{timestamp}.csv`

---

### FR-5: User Account System (Optional Free Tier)

**Priority:** High (MVP)  
**User Story:** As a returning user, I want to create a free account, so I can process 100 images/month and access my history.

**Acceptance Criteria:**

- Email/password signup (email verification)
- Login with JWT-based authentication
- Free tier: 100 images/month quota
- Usage tracking displays remaining quota
- Monthly quota resets automatically
- User can view processing history
- User can re-download previous CSVs

---

### FR-6: Self-Hosted Temporary Image URLs

**Priority:** Critical (MVP)  
**User Story:** As the product owner, I want images served from our server temporarily, so we eliminate per-image Cloudinary costs and enable a generous free tier.

**Acceptance Criteria:**

- Express serves /temp directory as static files
- Images compressed to 1024px, 85% quality JPEG
- UUID filenames prevent guessing (security)
- Files deleted after OpenAI processing (4-6 sec lifetime)
- Public HTTPS URLs generated automatically
- Zero external costs per image processed

**Business Impact:** This architectural decision enables 100 free images/month sustainability.

---

### FR-7: Parallel Batch Processing

**Priority:** High (MVP)  
**User Story:** As a photographer, I want my batch processed quickly, so I can download results in minutes, not hours.

**Acceptance Criteria:**

- 5 concurrent image processes (using p-limit)
- Average processing time: <2 seconds per image
- Total batch time: ~40 seconds for 10 images
- 3-4x faster than competitors (benchmarked)
- Error handling: failed images don't block others
- Graceful degradation under server load

**Competitive Advantage:** Speed is the primary differentiator vs MetaPhotoAI.

---

### FR-8: Simple Progress Feedback

**Priority:** High (MVP)  
**User Story:** As a user, I want to see processing progress, so I know the system is working and estimate completion time.

**Acceptance Criteria:**

- Progress bar shows percentage complete
- Text displays: "Processing X of Y images..."
- Updates in real-time (polling or SSE)
- Success/error states for individual images (visual indicators)
- Total time elapsed displayed
- No ability to cancel/retry in MVP (defer to V2)

---

### FR-9: Elegant Dark Mode UI

**Priority:** High (MVP)  
**User Story:** As a photographer, I want a beautiful, professional interface, so I trust the tool quality.

**Acceptance Criteria:**

- Dark mode as default (matches photo editing tools)
- Clean sans-serif typography (Inter or SF Pro)
- Large, generous whitespace
- Smooth animations (purposeful, not distracting)
- Muted, sophisticated color palette
- Professional aesthetic throughout
- Responsive design (desktop-first, mobile-friendly)

**Success Metric:** UI scores 8+/10 on ease-of-use rating from beta testers.

---

## Non-Functional Requirements

### Performance

**Why It Matters:** Speed is the core competitive advantage. Photographers value time savings.

**Requirements:**

**NFR-P1: Processing Speed**

- Average: <2 seconds per image (OpenAI API response + processing)
- Batch of 10 images: <40 seconds total
- Batch of 100 images: <7 minutes total
- Target: 3-4x faster than MetaPhotoAI (competitor)

**NFR-P2: Page Load**

- Landing page: <2 seconds (Time to Interactive)
- Upload interface: Instant response to drag-drop (<100ms)
- CSV download: Immediate (<1 second)

**NFR-P3: Optimization**

- Image compression: 1024px max dimension, 85% quality
- Thumbnail generation for preview: <500KB each
- Frontend bundle: <300KB gzipped
- API response times: <200ms excluding AI processing

---

### Security

**Why It Matters:** Handling user images and accounts requires trust and data protection.

**Requirements:**

**NFR-S1: Data Protection**

- All traffic over HTTPS only
- Temporary images deleted immediately after processing (max 10 sec lifetime)
- No images stored on server after processing complete
- User account passwords hashed with bcrypt (12 rounds minimum)
- JWT tokens expire after 7 days
- Environment variables for all secrets (never in code)

**NFR-S2: Abuse Prevention**

- Rate limiting: 10 images per IP per hour (anonymous)
- Cookie-based session tracking (prevents spam)
- File upload validation: type, size, count
- CSRF protection on all state-changing requests
- Input sanitization for all user data

**NFR-S3: Privacy**

- No image content logged or stored
- Metadata generated is user's property
- Clear privacy policy: "We process, not store"
- GDPR-compliant data handling (if EU users)

---

### Scalability

**Why It Matters:** Cost-effective growth from 10 to 1,000+ users.

**Requirements:**

**NFR-SC1: Horizontal Scaling**

- Stateless backend architecture (enables multiple instances)
- Database connection pooling
- Session storage in Redis (future) or JWT (MVP)
- CDN for static assets (future optimization)

**NFR-SC2: Cost Management**

- Zero per-image external costs (self-hosted architecture)
- OpenAI costs: $0.01-0.02 per image (GPT-5-mini)
- Server costs: $5-10/month flat rate (Railway/Render)
- Database: Free tier sufficient for 1,000 users (Postgres)

**NFR-SC3: Capacity Planning**

- MVP: Support 100 concurrent users
- Growth: 1,000 users processing 50K images/month
- Server capacity: Monitor and scale at 70% CPU threshold

---

### Accessibility

**Why It Matters:** Professional tools should be usable by all photographers, including those with disabilities.

**Requirements:**

**NFR-A1: WCAG 2.1 AA Compliance**

- Keyboard navigation for all functionality
- Screen reader compatibility
- Color contrast ratios meet AA standards (4.5:1 text)
- Alt text for all images and icons
- Focus indicators visible and clear

**NFR-A2: Responsive Design**

- Desktop-first design (primary use case)
- Mobile-friendly for on-the-go access
- Tablet optimization for iPad users
- Minimum viewport: 320px width

---

### Integration

**Why It Matters:** Seamless data flow to Adobe Stock and future integrations.

**Requirements:**

**NFR-I1: Adobe Stock CSV Compliance**

- Format validation against Adobe Stock spec
- Character encoding: UTF-8
- Keyword limits: 50 max per image
- Title length: 50-200 characters
- Category taxonomy: Match Adobe Stock categories exactly

**NFR-I2: API Design for Future Integrations**

- RESTful API conventions
- JSON request/response format
- API versioning strategy (/api/v1)
- Future: Webhook support for async processing
- Future: OAuth for third-party integrations

---

## Implementation Planning

### MVP Development Timeline (2 Weeks)

**Week 1: Backend + Core Processing**

- Days 1-2: Self-hosted temp URLs + HTTPS deployment
- Days 3-4: Parallel processing + OpenAI integration
- Day 5: Integration testing + performance validation

**Week 2: Frontend + Polish**

- Days 1-3: UI design + implementation + dark mode
- Days 4-5: End-to-end testing + bug fixes
- Days 6-7: Final polish + beta launch preparation

### Epic Breakdown Required

Due to project complexity, requirements must be decomposed into epics and bite-sized stories (200k context limit per story).

**Next Step:** Run `workflow create-epics-and-stories` to create the implementation breakdown.

### Suggested Epic Structure

1. **Epic 1:** Anonymous Processing Infrastructure
2. **Epic 2:** AI Metadata Generation Engine
3. **Epic 3:** User Interface & Experience
4. **Epic 4:** User Account System
5. **Epic 5:** Performance Optimization
6. **Epic 6:** Deployment & DevOps

---

## Competitive Positioning

### Primary Competitor: MetaPhotoAI

**Their Strengths:**

- Established market presence
- iOS mobile app
- FTP/SFTP upload support
- Proven business model
- Pricing: $12-36/month for 1,200-10,000 images

**Our Advantages:**

- ✅ **3-4x faster processing** (parallel processing, optimized architecture)
- ✅ **10x more generous free tier** (100 vs ~10-20 images)
- ✅ **Try without signup** (zero friction entry)
- ✅ **Simpler, cleaner UI** ("stupidly simple" design goal)
- ✅ **Lower cost structure** (self-hosted vs Cloudinary, enables better economics)

**Positioning Statement:**

> "Try Adobe Stock metadata generation properly before you buy. Process 100 images in 3 minutes. No signup required. 100 free images/month to start."

**Target Market (MVP):** Individual stock photographers seeking speed and simplicity over feature complexity.

**Future Markets (V2+):** Stock photo agencies, e-commerce sellers, bloggers/SEO optimizers.

---

## Risk Assessment & Mitigation

### Technical Risks

**Risk 1: OpenAI API Costs Exceed Projections**

- **Impact:** High - Could make free tier unsustainable
- **Probability:** Medium
- **Mitigation:**
  - Monitor costs daily during beta
  - Use GPT-5-mini (cheapest vision model)
  - Set hard limits on free tier (100/month)
  - Plan for pay-per-use tier if costs spike

**Risk 2: Self-Hosted URL Performance Issues**

- **Impact:** Medium - Could slow processing
- **Probability:** Low
- **Mitigation:**
  - Benchmark against Cloudinary before launch
  - Deploy to reliable platform (Railway/Render)
  - Monitor response times
  - Fallback: Cloudinary integration as backup

**Risk 3: AI Metadata Quality Below Expectations**

- **Impact:** High - Core value proposition fails
- **Probability:** Low (validated in brainstorming)
- **Mitigation:**
  - Extensive prompt engineering and testing
  - Temperature: 0.3 for accuracy
  - Beta testing with real photographers
  - Continuous prompt refinement based on feedback

### Business Risks

**Risk 4: Competitor Response**

- **Impact:** Medium - MetaPhotoAI could copy "try-first" model
- **Probability:** Medium
- **Mitigation:**
  - Move fast to capture market share
  - Build brand loyalty through UX excellence
  - Continuous innovation (V2 features)

**Risk 5: Market Size Smaller Than Expected**

- **Impact:** High - Limits growth potential
- **Probability:** Low (competitor existence validates market)
- **Mitigation:**
  - Validate with 100 users before heavy marketing
  - Plan expansion to adjacent markets (agencies, e-commerce)
  - Keep costs low to maintain sustainability

---

## References

- **Brainstorming Session:** [docs/bmm-brainstorming-session-2025-11-09.md](./bmm-brainstorming-session-2025-11-09.md)
- **Technical Documentation:** [docs/index.md](./index.md)
- **Backend API Documentation:** [docs/backend-utilities-api.md](./backend-utilities-api.md)

---

## Next Steps

1. **Epic & Story Breakdown** - Run: `@pm.mdc *create-epics-and-stories`
2. **Architecture Design** - Run: `@architect.mdc *architecture`
3. **UX Design** - Run: `@ux-designer.mdc *create-ux-design`
4. **Technical Specification** (if needed for complex components) - Run: `@architect.mdc *tech-spec`

---

## Appendix: Product Magic Summary

**The Essence of Adobe Stock Uploader:**

_"Photographers spend hundreds of hours manually entering metadata. We give them those hours back. The magic isn't in the AI—everyone has AI now. The magic is in removing every barrier between 'I have images' and 'I have Adobe Stock CSVs.' Three minutes. No signup. No complexity. Just results."_

**Competitive Philosophy:**

- While competitors add features → We remove friction
- While competitors require commitment → We deliver value first
- While competitors optimize for revenue → We optimize for speed

**Strategic Insight from Brainstorming:**

> "Sometimes the obvious solution isn't the necessary one."
>
> Cloudinary seemed essential, but questioning that assumption revealed a simpler, cheaper, better architecture. This principle guides all product decisions: Challenge "the way it's done" to find better approaches.

---

_This PRD captures the complete requirements for Adobe Stock Uploader MVP, synthesizing insights from the November 9, 2025 brainstorming session._

_Created through collaborative planning between Alex and AI Product Manager._

_Document Version: 1.0_  
_Last Updated: November 10, 2025_
