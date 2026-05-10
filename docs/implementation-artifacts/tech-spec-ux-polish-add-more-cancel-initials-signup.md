---
title: 'UX Polish: Add More Images Button, Cancel Processing, Initials Validation, Sign-Up Password UX'
slug: 'ux-polish-add-more-cancel-initials-signup'
created: '2026-05-10'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  [
    'React 19',
    'TypeScript',
    'Vite + SWC',
    'Tailwind CSS v4',
    'lucide-react',
    'shadcn/ui (Radix UI)',
    'Vitest + jsdom + @testing-library/react',
  ]
files_to_modify:
  [
    'client/src/components/UploadView.tsx',
    'client/src/components/ProcessingView.tsx',
    'client/src/pages/Home.tsx',
    'client/src/pages/SignUp.tsx',
    'tests/signup.test.tsx',
  ]
code_patterns:
  [
    'aria-invalid for red border on Input',
    'useRef for cancel flag + last status',
    'AlertDialog with open/onOpenChange',
    'onBlur per-field error pattern (SignUp)',
    'inline error <p className="text-sm text-red-500">',
  ]
test_patterns:
  [
    'vitest jsdom',
    '@testing-library/react fireEvent',
    'vi.mock for supabase + sonner + react-router',
    'MemoryRouter wrapper',
    'waitFor for async assertions',
  ]
---

# Tech-Spec: UX Polish: Add More Images Button, Cancel Processing, Initials Validation, Sign-Up Password UX

**Created:** 2026-05-10

## Overview

### Problem Statement

Four UX gaps exist in the current app:

1. The "Add more images" link is visually understated — users miss it when they want to add to an existing batch.
2. There is no way to cancel a batch that is in progress — users are stuck waiting with no escape.
3. The "Your Initials" field accepts any text (up to 5 chars); submitting with wrong data causes downstream CSV naming bugs.
4. The Sign Up form lacks a "Repeat password" field, password visibility toggles, and a meaningful disabled state on the submit button.

### Solution

Apply targeted UI changes to four components:

1. Upgrade "Add more images" from a subtle text link to a small, visible secondary button with a `+` icon.
2. Add a "Cancel" button to `ProcessingView` that triggers an `AlertDialog` confirmation, then cancels the polling loop in `Home.tsx` and returns to the upload view.
3. Enforce strict initials validation (exactly 2 English letters, auto-uppercase, inline error) in `Home.tsx` before allowing batch start.
4. Add a "Repeat Password" field, eye-toggle icons on both password inputs, and logic to disable "Create Account" until all fields are valid.

### Scope

**In Scope:**

- `client/src/components/UploadView.tsx` — "Add more images" button redesign
- `client/src/components/ProcessingView.tsx` — Cancel button + AlertDialog
- `client/src/pages/Home.tsx` — cancellation signal, initials validation, prop additions
- `client/src/pages/SignUp.tsx` — repeat password field, eye toggle, button disabled logic

**Out of Scope:**

- Backend cancel API (cancel is client-side polling stop only)
- Any changes to `src/components/ui/` shadcn components
- ResultsView, Login page, auth flow beyond SignUp.tsx
- New routes or navigation changes

## Context for Development

### Codebase Patterns

- Tailwind CSS v4 via `@tailwindcss/vite` — all utility classes work, no pre-build needed.
- shadcn/ui `Input` component (`client/src/components/ui/input.tsx`) has built-in `aria-invalid` styling: `aria-invalid:border-destructive aria-invalid:ring-destructive/20` — pass `aria-invalid={!!error}` to trigger red border. Already used in SignUp.tsx. Do NOT add custom red border CSS.
- shadcn/ui `AlertDialog` exports: `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction` (primary style), `AlertDialogCancel` (outline style). Control programmatically via `open={bool}` + `onOpenChange={setter}` on `AlertDialog` root — no `AlertDialogTrigger` needed when using a custom button.
- lucide-react installed; used in `ProcessingView` already. Add: `Plus` (UploadView), `Eye`/`EyeOff` (SignUp).
- Primary button: `grain-gradient px-6 py-4 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] text-primary-foreground rounded-2xl ...`
- Secondary/small button: `grain-gradient border border-border/30 rounded-xl hover:border-border/50 transition-all`
- Inline error: `<p className="text-sm text-red-500">{message}</p>` (SignUp.tsx pattern)
- `Home.tsx:handleGenerateMetadata` (line 115): `while (!isComplete)` polling loop. `lastStatusData` is a local `let` — must become a `useRef` to be accessible in cancel handler outside the loop.

### Files to Reference

| File                                        | Purpose                                                                                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `client/src/components/UploadView.tsx`      | "Add more images" button — lines 131-142 (the ternary rendering the link)                                                           |
| `client/src/components/ProcessingView.tsx`  | Add Cancel button + AlertDialog; add `onCancel` prop                                                                                |
| `client/src/components/ui/alert-dialog.tsx` | AlertDialog — use as-is, do NOT modify                                                                                              |
| `client/src/components/ui/input.tsx`        | Input — `aria-invalid` triggers red border automatically                                                                            |
| `client/src/pages/Home.tsx`                 | Polling loop (line 139), `handleGenerateMetadata` (line 115), `handleProcessingComplete` (line 256), initials field (lines 345-355) |
| `client/src/pages/SignUp.tsx`               | Password field (lines 152-177), submit button (lines 184-194), `validateForm` (line 22), error state (line 16)                      |
| `tests/signup.test.tsx`                     | Existing tests — will need updates for new fields and disabled-button logic                                                         |

### Technical Decisions

- **`lastStatusData` → ref:** Move from local `let` to `useRef<BatchStatusResponse | null>(null)` in `Home.tsx`. Update on every poll: `lastStatusDataRef.current = statusData`. This makes it accessible in the cancel handler defined outside `handleGenerateMetadata`.
- **Cancel mechanism:** Add `cancelledRef = useRef(false)` in `Home.tsx`. Reset to `false` at start of `handleGenerateMetadata`. Check `cancelledRef.current` each loop iteration — if true, break. On cancel confirmation (via `onCancel` prop call from `ProcessingView`): set `cancelledRef.current = true`, download partial CSV from `lastStatusDataRef.current` if any completed images exist (reuse logic from Home.tsx:202-216) + show toast _"X images exported before cancellation"_, then call `handleBackToUpload`.
- **Cancel race condition:** Guard `handleProcessingComplete`: `if (cancelledRef.current) return;` before `setView('results')`. Prevents 1500ms auto-transition firing after cancel confirmed.
- **`onCancel` prop signature:** `onCancel: (lastStatus: BatchStatusResponse | null) => void`. `ProcessingView` calls `onCancel(batchStatus)` on dialog confirm — passes current `batchStatus` prop so Home.tsx can extract partial results without needing its own ref access. (This is cleaner than accessing lastStatusDataRef in the callback.)
- **Cancel dialog:** `isConfirmOpen` state lives locally in `ProcessingView`. Use `AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}` (no `AlertDialogTrigger`). A plain `<button>` sets `setIsConfirmOpen(true)`. Show Cancel button even when `batchStatus` is null. Dialog: title = _"Stop processing?"_, description = _"This will stop processing and discard all progress."_, action = _"Yes, cancel"_ (calls `onCancel(batchStatus)` then closes), cancel = _"Keep waiting"_.
- **Initials validation:** Change `maxLength={5}` → `maxLength={2}`. Add `initialsError` state (`string`). `onChange`: enforce `value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()` — paste-safe. Clear `initialsError` when cleaned value has exactly 2 chars. `onBlur`: if `value.length > 0 && value.length !== 2`, set `initialsError`. Use `aria-invalid={!!initialsError}` on `Input` for red border. On Generate click: if not exactly 2 letters, set `initialsError` and return early. Remove existing `toast.error('Please enter your initials')`.
- **SignUp — new state:** Add `confirmPassword`, `showPassword`, `showConfirmPassword` (all `useState`). Add `hasInteracted` (`useState(false)`) — set `true` on any field's first `onChange`. Add `confirmPasswordError` to errors type.
- **SignUp — `isFormValid`:** `fullName.trim() && email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length >= 8 && confirmPassword === password && confirmPassword.length > 0`. Derived inline (not state).
- **SignUp — error timing:** Full Name/Email/Password errors: on **blur** (`onBlur` handler sets error if invalid). `confirmPassword` mismatch: on **change** of both `password` and `confirmPassword` fields, when `password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword`. Mismatch clears when they match.
- **SignUp — eye toggle:** Wrap each password `Input` in a relative `div`. Place `<button type="button">` with `Eye`/`EyeOff` icon absolutely positioned right side. Toggle `type="password"` ↔ `type="text"` via `showPassword`/`showConfirmPassword` state.
- **SignUp — disabled button hint:** When `hasInteracted && !isFormValid`, show `<p className="text-xs text-center opacity-50">Fill all fields to continue.</p>` below the submit button.
- **SignUp — test impact:** `signup.test.tsx` tests that click the button on empty/invalid form will break (button now disabled). Tests need updating: button-click tests must first fill all fields including `confirmPassword`, or test blur-based errors directly.
- **"Add more images" button:** Replace the `<button ... underline>` at UploadView.tsx:136. New: `<button onClick={onSelectImagesClick} className="flex items-center gap-1.5 px-3 py-1.5 text-[0.8rem] tracking-[-0.01em] border border-border/30 rounded-xl hover:border-border/50 transition-all"><Plus className="w-3 h-3" />Add more images</button>`.

## Implementation Plan

### Tasks

**Task 1: Upgrade "Add more images" to a visible button**

- File: `client/src/components/UploadView.tsx`
- Action: Replace lines 136-142 (the `<button ... underline>Add more images</button>`) with:
  ```tsx
  import { Plus } from 'lucide-react';
  // ...
  <button
    onClick={onSelectImagesClick}
    className="flex items-center gap-1.5 px-3 py-1.5 text-[0.8rem] tracking-[-0.01em] border border-border/30 rounded-xl hover:border-border/50 transition-all"
  >
    <Plus className="w-3 h-3" />
    Add more images
  </button>;
  ```
- Notes: Add `Plus` to the lucide-react import at the top of the file. No other changes to UploadView.tsx.

**Task 2: Add cancel infrastructure to Home.tsx**

- File: `client/src/pages/Home.tsx`
- Action A — Add two refs after existing refs (line ~40):
  ```tsx
  const cancelledRef = useRef(false);
  const lastStatusDataRef = useRef<BatchStatusResponse | null>(null);
  ```
- Action B — In `handleGenerateMetadata`, reset refs at start (after line 126 `setIsProcessing(true)`):
  ```tsx
  cancelledRef.current = false;
  lastStatusDataRef.current = null;
  ```
- Action C — Inside the `while` loop, after `const statusData = await getBatchStatus(batchId)` (line ~143), add:
  ```tsx
  lastStatusDataRef.current = statusData;
  if (cancelledRef.current) break;
  ```
- Action D — Guard `handleProcessingComplete` against race with cancel:
  ```tsx
  const handleProcessingComplete = useCallback(() => {
    if (cancelledRef.current) return;
    setView('results');
  }, []);
  ```
- Action E — Add `onCancel` handler and pass to `ProcessingView`:
  ```tsx
  const handleCancelProcessing = useCallback(
    (lastStatus: BatchStatusResponse | null) => {
      cancelledRef.current = true;
      const csvData = (lastStatus?.images ?? [])
        .filter(img => img.status === 'completed' && img.metadata)
        .map(img => ({
          filename: img.filename,
          title: img.metadata!.title,
          keywords: img.metadata!.keywords,
          category: img.metadata!.category,
        }));
      if (csvData.length > 0) {
        downloadCSV(generateCSV(csvData, initials), `${initials}_${Date.now()}.csv`);
        toast.warning(
          `${csvData.length} image${csvData.length !== 1 ? 's' : ''} exported before cancellation`
        );
      }
      handleBackToUpload();
    },
    [initials, handleBackToUpload]
  );
  ```
  Pass to ProcessingView: `onCancel={handleCancelProcessing}`
- Notes: `BatchStatusResponse` is already imported via types. `downloadCSV`, `generateCSV`, `toast` already imported.

**Task 3: Add Cancel button and AlertDialog to ProcessingView**

- File: `client/src/components/ProcessingView.tsx`
- Action A — Add `onCancel` to the props interface:
  ```tsx
  interface ProcessingViewProps {
    images: UploadedImage[];
    batchStatus: BatchStatusResponse | null;
    onComplete: () => void;
    onBackToUpload: () => void;
    onCancel: (lastStatus: BatchStatusResponse | null) => void;
  }
  ```
- Action B — Add `isConfirmOpen` state inside the component:
  ```tsx
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  ```
- Action C — Add AlertDialog import at top:
  ```tsx
  import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
  } from './ui/alert-dialog';
  ```
- Action D — Add Cancel button to the progress info card (inside the card, after the progress bar section, before the completion summary). Show it when `!isFinished`:
  ```tsx
  {
    !isFinished && (
      <button
        onClick={() => setIsConfirmOpen(true)}
        className="text-[0.8rem] tracking-[-0.01em] opacity-50 hover:opacity-80 transition-opacity underline underline-offset-2 self-start"
      >
        Cancel
      </button>
    );
  }
  ```
- Action E — Add AlertDialog after the main container `<div>`:
  ```tsx
  <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Stop processing?</AlertDialogTitle>
        <AlertDialogDescription>
          This will stop processing and discard all progress.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep waiting</AlertDialogCancel>
        <AlertDialogAction
          onClick={() => {
            setIsConfirmOpen(false);
            onCancel(batchStatus);
          }}
        >
          Yes, cancel
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  ```
- Notes: The null `batchStatus` state (initial spinner) should also show the Cancel button — move the `<button>` to appear in both the null-state and normal-state renders, or refactor to a single return.

**Task 4: Add initials field validation in Home.tsx**

- File: `client/src/pages/Home.tsx`
- Action A — Add `initialsError` state:
  ```tsx
  const [initialsError, setInitialsError] = useState('');
  ```
- Action B — Replace the initials `Input` onChange (line ~349) with enforced handler:
  ```tsx
  onChange={e => {
    const cleaned = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
    setInitials(cleaned);
    if (cleaned.length === 2) setInitialsError('');
  }}
  ```
- Action C — Add `onBlur` to the initials `Input`:
  ```tsx
  onBlur={() => {
    if (initials.length > 0 && initials.length !== 2) {
      setInitialsError('Exactly 2 letters required');
    }
  }}
  ```
- Action D — Add `aria-invalid` and `aria-describedby` to the initials `Input`:
  ```tsx
  aria-invalid={!!initialsError}
  aria-describedby={initialsError ? 'initials-error' : undefined}
  ```
- Action E — Change `maxLength={5}` to `maxLength={2}`.
- Action F — Add inline error below the Input:
  ```tsx
  {
    initialsError && (
      <p id="initials-error" className="text-sm text-red-500">
        {initialsError}
      </p>
    );
  }
  ```
- Action G — Replace the early return in `handleGenerateMetadata` (line ~116-119):
  ```tsx
  // Remove: if (!initials) { toast.error('Please enter your initials'); return; }
  // Replace with:
  if (initials.length !== 2) {
    setInitialsError('Exactly 2 letters required');
    return;
  }
  ```

**Task 5: Add confirm password, eye toggles, and form validity to SignUp.tsx**

- File: `client/src/pages/SignUp.tsx`
- Action A — Add new state variables:
  ```tsx
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  ```
- Action B — Extend errors type to include `confirmPassword`:
  ```tsx
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  ```
- Action C — Add `isFormValid` derived boolean:
  ```tsx
  const isFormValid =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    password.length >= 8 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;
  ```
- Action D — Add per-field `onBlur` handlers for Full Name, Email, Password (clear error on change already exists; add blur to set it):
  ```tsx
  // Full Name onBlur:
  onBlur={() => { if (!fullName.trim()) setErrors(prev => ({ ...prev, fullName: 'Full name is required' })); }}
  // Email onBlur:
  onBlur={() => {
    if (!email.trim()) setErrors(prev => ({ ...prev, email: 'Email is required' }));
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) setErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
  }}
  // Password onBlur:
  onBlur={() => {
    if (!password) setErrors(prev => ({ ...prev, password: 'Password is required' }));
    else if (password.length < 8) setErrors(prev => ({ ...prev, password: 'Password must be at least 8 characters' }));
  }}
  ```
- Action E — Update `password` onChange to also check mismatch with confirmPassword:
  ```tsx
  onChange={e => {
    setPassword(e.target.value);
    if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
    if (hasInteracted) setHasInteracted(true); // already true
    // check mismatch
    if (confirmPassword.length > 0 && e.target.value.length > 0 && e.target.value !== confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
    } else {
      setErrors(prev => ({ ...prev, confirmPassword: undefined }));
    }
  }}
  ```
- Action F — Set `hasInteracted` on all field onChange handlers: add `if (!hasInteracted) setHasInteracted(true);` to each.
- Action G — Wrap Password `Input` in relative div with eye toggle button; change type dynamically:
  ```tsx
  <div className="relative">
    <Input
      id="password"
      type={showPassword ? 'text' : 'password'}
      // ... existing props ...
    />
    <button
      type="button"
      onClick={() => setShowPassword(v => !v)}
      className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70 transition-opacity"
      aria-label={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  </div>
  ```
- Action H — Add "Repeat Password" field after Password field, following the same structure with `showConfirmPassword` toggle and instant mismatch validation:
  ```tsx
  <div className="space-y-2">
    <Label
      htmlFor="confirmPassword"
      className="tracking-[-0.01em] opacity-50 text-[0.75rem] uppercase"
    >
      Repeat Password
    </Label>
    <div className="relative">
      <Input
        id="confirmPassword"
        type={showConfirmPassword ? 'text' : 'password'}
        placeholder="••••••••"
        value={confirmPassword}
        aria-invalid={!!errors.confirmPassword}
        aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
        className={inputClassName}
        onChange={e => {
          if (!hasInteracted) setHasInteracted(true);
          setConfirmPassword(e.target.value);
          if (password.length > 0 && e.target.value.length > 0 && password !== e.target.value) {
            setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
          } else {
            setErrors(prev => ({ ...prev, confirmPassword: undefined }));
          }
        }}
      />
      <button
        type="button"
        onClick={() => setShowConfirmPassword(v => !v)}
        className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70 transition-opacity"
        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
      >
        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
    {errors.confirmPassword && (
      <p id="confirmPassword-error" className="text-sm text-red-500">
        {errors.confirmPassword}
      </p>
    )}
  </div>
  ```
- Action I — Update `validateForm` to include confirmPassword check (for server-side guard):
  ```tsx
  if (!confirmPassword) {
    newErrors.confirmPassword = 'Please confirm your password';
  } else if (password !== confirmPassword) {
    newErrors.confirmPassword = 'Passwords do not match';
  }
  ```
- Action J — Update submit button: `disabled={!isFormValid || isSubmitting}`.
- Action K — Add hint below submit button:
  ```tsx
  {
    hasInteracted && !isFormValid && (
      <p className="text-xs text-center opacity-50 relative z-10">Fill all fields to continue.</p>
    );
  }
  ```
- Action L — Add `Eye`, `EyeOff` to lucide-react import.

**Task 6: Update signup.test.tsx**

- File: `tests/signup.test.tsx`
- Action A — Update `renderSignUp` helper — no change needed (MemoryRouter wrapper is sufficient).
- Action B — Update "renders form with all required fields" test: add assertion for `Repeat Password` field and that button is initially disabled.
- Action C — Update all tests that click the "Create Account" button with invalid/incomplete form — button is now disabled. Change approach: test blur-based errors instead, or fill all 4 fields (including `confirmPassword`) before clicking.
- Action D — Update "calls supabase.auth.signUp" test and "navigates to /" test to also fill `confirmPassword`.
- Action E — Update "disables submit button during API call" test: fill all 4 fields first.
- Action F — Add new tests:
  - "button is disabled when form is incomplete"
  - "button enables when all fields are valid"
  - "shows mismatch error instantly when passwords differ"
  - "clears mismatch error when passwords match"
  - "toggles password visibility when eye icon clicked"
  - "shows blur error for empty full name on blur"
  - "shows hint text when user has interacted but form is invalid"

### Acceptance Criteria

**Feature 1 — Add more images button**

- [ ] AC 1: Given images are loaded (non-empty, below limit), when the upload view renders, then a button with a `+` icon and text "Add more images" appears right-aligned in the header row (not an underlined text link).
- [ ] AC 2: Given the image limit is reached, when the upload view renders, then "Add more images" button is not shown (replaced by "Limit reached" text — existing behaviour preserved).
- [ ] AC 3: Given `isUploading` is true, when the upload view renders, then "Add more images" button is not shown (replaced by "Uploading..." — existing behaviour preserved).

**Feature 2 — Cancel processing**

- [ ] AC 4: Given processing has started (view = 'processing'), when the processing view renders, then a "Cancel" button is visible even before the first poll response (batchStatus = null).
- [ ] AC 5: Given processing is in progress, when the user clicks "Cancel", then an AlertDialog appears with title "Stop processing?", body "This will stop processing and discard all progress.", and buttons "Yes, cancel" and "Keep waiting".
- [ ] AC 6: Given the cancel dialog is open, when the user clicks "Keep waiting", then the dialog closes and processing continues uninterrupted.
- [ ] AC 7: Given the cancel dialog is open, when the user clicks "Yes, cancel", then processing stops, the app returns to the upload view (step 1), and all images and state are cleared.
- [ ] AC 8: Given the cancel dialog is open and 3 of 10 images have completed, when the user clicks "Yes, cancel", then a partial CSV of those 3 images is downloaded and a toast shows "3 images exported before cancellation".
- [ ] AC 9: Given the cancel dialog is open and 0 images have completed, when the user clicks "Yes, cancel", then no CSV is downloaded and the app returns to upload view silently.
- [ ] AC 10: Given processing completes in the 1500ms auto-transition window while the cancel dialog is open, when the user confirms cancel, then the app goes to upload view (not results view).
- [ ] AC 11: Given processing is finished (completed or failed), when the processing view renders, then the "Cancel" button is not visible.

**Feature 3 — Initials validation**

- [ ] AC 12: Given the initials field is empty and the user clicks "Generate & Export CSV", then an inline error "Exactly 2 letters required" appears below the field and the batch does not start.
- [ ] AC 13: Given the user types "a" into the initials field, then the field shows "A" (auto-uppercased).
- [ ] AC 14: Given the user types "abc" into the initials field, then the field shows "AB" (stripped to 2 chars).
- [ ] AC 15: Given the user pastes "OLEKSII" into the initials field, then the field shows "OL" (paste handled by onChange enforcer, not maxLength alone).
- [ ] AC 16: Given the user types "1a" into the initials field, then the field shows "A" (non-alpha stripped).
- [ ] AC 17: Given the user has typed one letter and blurs the field, then a red border appears on the field.
- [ ] AC 18: Given the user has a red border on the field (1 letter) and types a second letter, then the red border clears.
- [ ] AC 19: Given the initials field has exactly 2 valid letters, when the user clicks "Generate & Export CSV", then processing proceeds normally.

**Feature 4 — Sign Up improvements**

- [ ] AC 20: Given the sign up page loads, when the user views the form, then a "REPEAT PASSWORD" field appears between Password and the submit button, with an eye-toggle icon on both password fields.
- [ ] AC 21: Given the password field shows dots, when the user clicks the eye icon, then the password becomes visible (type switches to text) and the icon changes to EyeOff; clicking again hides it.
- [ ] AC 22: Given the user has not interacted with the form, when the form renders, then the "Create Account" button is disabled and no hint text is shown.
- [ ] AC 23: Given the user starts typing in any field, when the form is still incomplete, then the hint "Fill all fields to continue." appears below the disabled button.
- [ ] AC 24: Given the user fills password "password123" and confirm password "password456", then a "Passwords do not match" error appears instantly below the confirm field.
- [ ] AC 25: Given a mismatch error is showing and the user corrects the confirm password to match, then the error clears immediately.
- [ ] AC 26: Given the user edits the password field after confirm is filled and they now differ, then the mismatch error appears on the confirm field.
- [ ] AC 27: Given all 4 fields are valid and passwords match, when the form is in that state, then the "Create Account" button is enabled and no hint text is shown.
- [ ] AC 28: Given the confirm password field is empty, then no mismatch error is shown (only caught on submit).

## Additional Context

### Dependencies

- `lucide-react`: `Plus` (UploadView), `Eye`, `EyeOff` (SignUp) — all already installed, zero new packages
- `@radix-ui/react-alert-dialog` via shadcn `AlertDialog` — already installed
- No backend changes required

### Testing Strategy

**Unit tests to update — `tests/signup.test.tsx`:**

- Update 6 existing tests that interact with the submit button (must now fill all 4 fields including `confirmPassword`)
- Update "renders form with all required fields" to assert `Repeat Password` field exists and button is initially disabled
- Add 7 new test cases (see Task 6)

**No existing tests for ProcessingView, UploadView, Home.tsx** — no breakage risk there. Manual testing covers those features.

**Manual testing checklist:**

1. Upload images → verify "Add more images" is a visible bordered button with + icon
2. Upload images → click Generate → verify Cancel button visible from the start
3. Click Cancel mid-process → verify dialog copy, "Keep waiting" dismisses, "Yes, cancel" returns to upload
4. Cancel with partial results → verify partial CSV downloads with toast
5. Type initials: lowercase → uppercase; non-alpha → stripped; paste long string → truncated to 2
6. Blur with 1 letter → red border; add 2nd letter → border clears
7. Click Generate with empty/1-letter initials → inline error, no batch start
8. Sign Up: eye icons toggle visibility on both fields
9. Sign Up: type mismatched passwords → instant error; fix → error clears
10. Sign Up: edit original password after confirm filled → mismatch shows
11. Sign Up: button disabled until all fields valid; hint appears after first interaction

### Notes

**User persona focus group findings (applied to spec):**

| #   | Feature                 | Concern                                                                                                | Decision                                                                                                                                     |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Add more images         | "Add more" affordance is invisible — users (esp. casual) don't know it exists and restart from scratch | Validated: upgrade to `+` icon button; keep it right-aligned alongside the image count                                                       |
| 2   | Cancel processing       | "Are you sure?" dialog copy is too vague — users don't know they'll lose progress                      | Dialog title: _"Stop processing?"_ / Body: _"This will stop processing and discard all progress."_ / Buttons: "Yes, cancel" / "Keep waiting" |
| 3   | Initials validation     | On-submit-only validation misses early feedback — users with 3+ chars typed don't know yet             | Add live red border when input is invalid (not exactly 2 alpha chars); keep blocking error message on Generate click                         |
| 4   | Sign Up disabled button | Greyed-out button with no explanation traps users — they don't know what field is wrong                | Show inline errors on blur per field; button stays disabled until all fields valid + errors cleared                                          |

### Notes

**User persona focus group findings (applied to spec):**

| #   | Feature                 | Concern                                                                                                | Decision                                                                                                                                     |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Add more images         | "Add more" affordance is invisible — users (esp. casual) don't know it exists and restart from scratch | Validated: upgrade to `+` icon button; keep it right-aligned alongside the image count                                                       |
| 2   | Cancel processing       | "Are you sure?" dialog copy is too vague — users don't know they'll lose progress                      | Dialog title: _"Stop processing?"_ / Body: _"This will stop processing and discard all progress."_ / Buttons: "Yes, cancel" / "Keep waiting" |
| 3   | Initials validation     | On-submit-only validation misses early feedback — users with 3+ chars typed don't know yet             | Add live red border when input is invalid (not exactly 2 alpha chars); keep blocking error message on Generate click                         |
| 4   | Sign Up disabled button | Greyed-out button with no explanation traps users — they don't know what field is wrong                | Show inline errors on blur per field; button stays disabled until all fields valid + errors cleared                                          |
