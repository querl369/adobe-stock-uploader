# Correct Course Context — Figma Design Integration

**Date:** 2026-03-26
**Purpose:** Pre-loaded context for `/bmad-bmm-correct-course` workflow
**Trigger:** New Figma designs require significant additions to Epic 6 and PRD

---

## 1. Change Trigger

New Figma UI designs have been created for the application and are available at:

```
references/Elegant Minimalist Web App (1)/src/
```

These designs introduce **new pages and features** that go beyond the current Epic 6 plan and require PRD updates, epic/story revisions, and sprint replanning.

### Change Type

- **New requirements emerged from design work** — not a failure or technical limitation
- The Figma export is a fully working Vite + React reference app with React Router, shadcn/ui components, and matching design system (grain texture, lava-lamp buttons, light theme)

---

## 2. Current Project State

### Completed Epics

- **Epic 1:** Architecture & Foundation — verified
- **Epic 2:** Anonymous Image Processing Pipeline — verified
- **Epic 3:** AI Metadata Generation Engine — done (all 5 stories code-reviewed)
- **Epic 4:** CSV Export & Download — done (all 3 stories)

### In-Progress Epic

- **Epic 5:** User Interface & Experience — in progress
  - 5.1 Component Architecture & App Decomposition — **done**
  - 5.2 Upload Experience & File Validation — **done**
  - 5.3 Processing View & Real-Time Status — **done**
  - 5.4 Results View & Metadata Preview — **done**
  - 5.5 Dark Mode Default & Visual Polish — **backlog**
  - 5.6 Responsive Design & Mobile Optimization — **backlog**
  - 5.7 Error Handling & Toast Notifications — **ready-for-dev**

### Planned Epic

- **Epic 6:** User Account System — fully **backlog** (7 stories: 6.1–6.7)

---

## 3. Figma Design Inventory

The reference app at `references/Elegant Minimalist Web App (1)/src/` contains these files:

| File                 | Page/Feature       | Description                                                                                                                                            |
| -------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Root.tsx`           | Root layout        | Fixed header with nav links (Pricing, Login, Sign Up, Account), fixed footer, `<Outlet />` for nested routes                                           |
| `Home.tsx`           | Home / Upload      | Drop zone with DnD, image grid preview, progress bar, initials input, generate/clear buttons                                                           |
| `Login.tsx`          | `/login`           | Email + password form, "Forgot?" link, Sign In lava-button, link to signup                                                                             |
| `SignUp.tsx`         | `/signup`          | Full name + email + password form, Create Account lava-button, link to login                                                                           |
| `Plans.tsx`          | `/plans`           | 3-tier pricing page (First $5, Second $23, Third $40), middle tier highlighted with `scale-105` and `shadow-2xl`, lava-lamp CTA on popular tier        |
| `AccountLayout.tsx`  | `/account/*`       | Dashboard layout with sidebar nav (Profile, History, Billing, Log out), `<Outlet />` for nested tab routes                                             |
| `AccountProfile.tsx` | `/account` (index) | Profile form: Full Name, Email, Default Initials, Save Changes button                                                                                  |
| `History.tsx`        | `/account/history` | Session list (name, date, time, image count), click-to-download CSV, animated download icon on hover                                                   |
| `Billing.tsx`        | `/account/billing` | Current plan display (tier name, status badge, auto-renewal date), Change Plan link to `/plans`, payment method, billing email, recent invoices ledger |
| `routes.ts`          | Router config      | `createBrowserRouter` with nested `/account` routes (index → Profile, `/history`, `/billing`)                                                          |

### Design System Notes

- **Theme:** Light mode (`#fafafa` bg, `#0a0a0a` fg) — note: current app uses dark mode
- **CSS effects:** `grain` (full-page noise overlay), `grain-gradient` (per-element noise), `lava-button` (animated gradient on hover) — all defined in `styles/globals.css`
- **Component library:** shadcn/ui (same as current app) — `Input`, `Label`, `Progress` used
- **Additional dependency:** `lucide-react` for icons (`Check`, `Download`, `FileText`)
- **Typography:** Tight tracking (`-0.02em` to `-0.04em`), opacity-based hierarchy, clamp-based responsive sizes
- **Border radius:** Large rounded corners (`rounded-2xl`, `rounded-[2rem]`, `rounded-[2.5rem]`)
- **Dark mode vars:** Fully defined in globals.css using `oklch()` color space

---

## 4. Gap Analysis: Figma vs Current Plan

### Features with Existing Coverage (need UI alignment)

| Figma Feature            | Current Story | Gap                                                                                                                           |
| ------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Login page (`/login`)    | Story 6.2     | 6.2 is full-stack (backend auth + frontend). Figma provides the exact UI to implement.                                        |
| Sign Up page (`/signup`) | Story 6.1     | 6.1 is full-stack. Figma provides the exact UI. Note: Figma has "Full Name" field — current 6.1 doesn't mention a name field. |
| Account Profile          | Story 6.6     | 6.6 covers settings/profile management. Figma specifies "Default Initials" field (important for metadata generation).         |
| Processing History       | Story 6.5     | 6.5 covers history + CSV re-download. Figma adds session-name display and click-anywhere-to-download UX.                      |

### Features NOT in Current Plan (net new)

| Figma Feature                                    | Impact                                                                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plans & Pricing page** (`/plans`)              | Entirely new page. 3 subscription tiers with pricing. Story 6.7 only covers upgrade _prompts_, not a dedicated pricing page.                                  |
| **Billing tab** (`/account/billing`)             | Entirely new. Shows current plan, auto-renewal date, payment method, billing email, invoice history. No current story covers subscription billing management. |
| **Account routing layout** (`AccountLayout.tsx`) | New architectural pattern. Sidebar navigation + React Router nested `<Outlet />`. Current stories assume flat page structure.                                 |
| **Header navigation update**                     | Root layout adds Pricing, Login, Sign Up, Account links. Current header only has app branding.                                                                |
| **Light mode design**                            | Figma uses light theme. Current app is dark-mode-first. Story 5.5 (Dark Mode Default & Visual Polish) may need revision.                                      |

### Subscription Tiers (from Figma)

| Tier        | Price  | Images/Month | Key Features                              |
| ----------- | ------ | ------------ | ----------------------------------------- |
| First Tier  | $5/mo  | 1,000        | Standard AI, CSV exports, email support   |
| Second Tier | $23/mo | 5,000        | Advanced AI, CSV + JSON, priority support |
| Third Tier  | $40/mo | 10,000       | Custom AI prompts, API access, 24/7 phone |

**Note:** Current PRD only defines a **free tier** (100 images/month). The Figma introduces a **paid subscription model** with 3 tiers — this is a significant PRD scope expansion.

---

## 5. Recommended Changes (for Correct Course to evaluate)

### PRD Updates Needed

1. Add subscription tier definitions (3 paid tiers + free tier)
2. Add Plans & Pricing page as a feature
3. Add Billing management as a feature
4. Revise monetization section (currently "future" — Figma makes it concrete)

### Epic 5 Impact

- **Story 5.5** (Dark Mode): May need scope revision — Figma is light-mode-first. The app needs to support both or choose primary. Consider if dark mode should remain default or switch to light.
- **Header/Nav**: Root layout needs to evolve from current `AppHeader` to include auth-aware navigation links

### Epic 6 Revisions Needed

1. **Story 6.1 (Sign Up)**: Add "Full Name" field from Figma, reference `SignUp.tsx` for exact UI
2. **Story 6.2 (Login)**: Reference `Login.tsx` for exact UI, add "Forgot?" placeholder link
3. **Story 6.5 (History)**: Update to match Figma's session-card-click-to-download pattern
4. **Story 6.6 (Account Settings)**: Restructure as nested route inside `AccountLayout`, add "Default Initials" field
5. **Story 6.7 (Upgrade Prompts)**: Split or expand — currently only covers prompt banners, needs to also cover the dedicated Plans page

### New Stories Needed

1. **Account Layout & Routing** — New story for `AccountLayout.tsx` with sidebar nav and React Router nested routes
2. **Plans & Pricing Page** — New story for the 3-tier pricing page with highlighted middle tier
3. **Billing Management Tab** — New story for subscription status, payment info, and invoice ledger
4. **Header Navigation Update** — New story (or fold into existing) for auth-aware header with Pricing/Login/SignUp/Account links

---

## 6. Figma Reference File Map

For the Correct Course workflow to reference specific design implementations:

```
references/Elegant Minimalist Web App (1)/src/
  App.tsx                  — Router provider entry point
  routes.ts                — Route definitions (copy pattern for project router)
  Root.tsx                 — Header/footer shell with <Outlet />
  Home.tsx                 — Upload page (reference for existing component alignment)
  Login.tsx                — Login form UI
  SignUp.tsx               — Sign-up form UI
  Plans.tsx                — 3-tier pricing page
  AccountLayout.tsx        — Account dashboard sidebar + nested <Outlet />
  AccountProfile.tsx       — Profile tab content
  History.tsx              — History tab with session cards + CSV download
  Billing.tsx              — Billing tab with plan status + invoices
  styles/globals.css       — CSS variables, grain/lava-lamp effects, dark mode
  components/ui/           — shadcn/ui components (same library as current app)
  components/figma/        — ImageWithFallback helper component
```

---

## 7. Open Questions for Correct Course

1. **Theme direction:** Should the app switch from dark-mode-first to light-mode-first (matching Figma), or keep dark mode default and adapt Figma designs? Story 5.5 is impacted.
2. **Paid tiers scope:** Is the subscription/billing system part of MVP, or should the Plans and Billing pages be UI-only (static display) with backend payment integration deferred?
3. **Epic 5 vs Epic 6 sequencing:** Should remaining Epic 5 stories (5.5, 5.6, 5.7) be completed first, or can Epic 6 work begin in parallel?
4. **Authentication backend:** The Figma provides frontend-only designs. Current Epic 6 stories describe full-stack auth (bcrypt, JWT, database). Should the frontend pages be implemented first as static UI, then connected to backend in separate stories?
5. **Free tier:** Current PRD defines a free tier (100 images/month). Figma only shows paid tiers ($5/$23/$40). Should there still be a free tier?
