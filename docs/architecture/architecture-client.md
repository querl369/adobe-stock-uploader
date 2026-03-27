# Frontend Architecture - React Client

## Executive Summary

The Adobe Stock Uploader frontend is a single-page React application built with TypeScript, Vite, and shadcn/ui. It provides an elegant, minimalist interface for bulk image upload and AI-powered metadata generation with drag-and-drop support and real-time progress tracking.

**Tech Stack**: React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, Supabase
**Architecture**: Component-based SPA with client-side routing
**Build Tool**: Vite 7.2.2
**UI Framework**: Tailwind CSS + Custom glassmorphism design

**⚠️ Frontend Architecture Note (Updated 2026-03-26):**
Epic 6 introduces significant frontend additions per Sprint Change Proposal 2026-03-26:

- **React Router:** Client-side routing with `createBrowserRouter` for multi-page navigation
- **Supabase Auth:** Authentication via `@supabase/supabase-js` with AuthProvider context
- **Account Dashboard:** Nested routing with `AccountLayout` sidebar + `<Outlet />`
- **Feature Flags:** `FEATURE_PLANS_PAGE` gates Plans and Billing UI
- **Figma Reference:** `references/Elegant Minimalist Web App (1)/src/` provides exact UI specs

All existing UI components, styling, and state management patterns remain unchanged. The upload flow at `/` works identically after Router integration.

---

## Technology Stack

### Core Framework

| Technology | Version | Purpose                 |
| ---------- | ------- | ----------------------- |
| React      | 19.2.0  | UI framework            |
| TypeScript | 5.8.2   | Type safety             |
| Vite       | 7.2.2   | Build tool + dev server |

### UI & Styling

| Technology               | Version | Purpose               |
| ------------------------ | ------- | --------------------- |
| Tailwind CSS             | 3.x     | Utility-first CSS     |
| shadcn/ui                | Latest  | Component library     |
| Radix UI                 | Latest  | Accessible primitives |
| Lucide React             | 0.553.0 | Icon library          |
| class-variance-authority | 0.7.1   | Component variants    |
| tailwind-merge           | 3.3.1   | Class merging utility |
| clsx                     | 2.1.1   | Conditional classes   |

### Routing & Auth (Epic 6)

| Technology            | Version | Purpose             |
| --------------------- | ------- | ------------------- |
| react-router-dom      | 6.x     | Client-side routing |
| @supabase/supabase-js | 2.x     | Auth, database, RLS |

### Functionality

| Technology              | Version | Purpose            |
| ----------------------- | ------- | ------------------ |
| react-dnd               | 16.0.1  | Drag & drop        |
| react-dnd-html5-backend | 16.0.1  | HTML5 drag backend |

---

## Architecture Pattern

### Component-Based Architecture with Client-Side Routing

```
App (RouterProvider)
├── AuthProvider (Supabase auth context)
│   └── Root Layout (Header + <Outlet /> + Footer)
│       │
│       ├── / → Home (Upload flow)
│       │   └── DropZone (Drag & drop wrapper)
│       │       ├── UploadView (File picker, thumbnail grid, validation)
│       │       ├── ProcessingView (Progress bar, per-image status)
│       │       └── ResultsView (Metadata preview, CSV download)
│       │
│       ├── /login → Login Page (Supabase Auth)
│       ├── /signup → Signup Page (Supabase Auth)
│       ├── /plans → Plans & Pricing (feature-flagged)
│       │
│       └── /account → ProtectedRoute → AccountLayout
│           ├── Sidebar Nav (Profile, History, Billing, Log out)
│           └── <Outlet /> (nested content)
│               ├── /account → AccountProfile (index)
│               ├── /account/history → History
│               └── /account/billing → Billing (feature-flagged)
│
└── UI Components (shadcn/ui - 47 components)
    ├── Input, Label, Progress, Table, Badge
    └── [42 other available components]
```

### Key Architectural Patterns (Epic 6)

**React Router:** `createBrowserRouter` with nested routes and `<Outlet />` for layout composition. Root layout provides header/footer, AccountLayout provides sidebar nav.

**Auth Context:** `AuthProvider` wraps the app, provides `useAuth()` hook with `{ user, session, isLoading, signOut }`. Listens to `supabase.auth.onAuthStateChange()` for real-time state.

**Protected Routes:** `ProtectedRoute` component checks auth state, redirects to `/login` if not authenticated, shows loading state while checking.

**Feature Flags:** `VITE_FEATURE_PLANS_PAGE` env var gates Plans page, Billing tab, "Pricing" header link, and upgrade prompts. Components check flag internally and return null when disabled.

---

## Component Architecture

### Main App Component

**Location**: `client/src/app.tsx` (508 lines)

**Responsibilities**:

1. **State Management**: Images, initials, processing state
2. **File Handling**: Upload, preview, validation
3. **API Integration**: Batch processing, CSV export, cleanup
4. **UI Orchestration**: Conditional rendering, animations
5. **Lifecycle Management**: Mount/unmount cleanup

**State Structure**:

```typescript
// Application state
const [images, setImages] = useState<UploadedImage[]>([]);
const [initials, setInitials] = useState('');
const [isDragging, setIsDragging] = useState(false);
const [processing, setProcessing] = useState<ProcessingState>({
  isProcessing: false,
  currentIndex: 0,
  currentFileName: '',
});

// Type definitions
interface UploadedImage {
  id: string; // Random ID
  file: File; // Original File object
  preview: string; // Object URL for preview
  description?: string; // Optional AI-generated desc
  title?: string; // AI-generated title
  keywords?: string; // AI-generated keywords
  category?: number; // Adobe Stock category
}

interface ProcessingState {
  isProcessing: boolean; // Currently processing flag
  currentIndex: number; // Current image index
  currentFileName: string; // Current file being processed
}
```

**Key Methods**:

#### `handleFileSelect(files: File[]): Promise<void>`

- Filters for image files only
- Uploads each file to backend via `/api/upload`
- Creates Object URLs for preview
- Updates state with new images

#### `handleGenerateMetadata(): Promise<void>`

- Validates initials input
- Sends batch to `/api/process-batch`
- Updates images with metadata
- Triggers automatic CSV download
- Handles errors gracefully

#### `handleClear(): Promise<void>`

- Revokes all Object URLs (prevent memory leaks)
- Clears images and initials state
- Calls `/api/cleanup` to clean server files
- Resets file input

---

### DropZone Component

**Location**: `client/src/app.tsx` (lines 32-86)

**Technology**: react-dnd with HTML5Backend

**Responsibilities**:

1. Native file drop handling
2. Visual feedback on drag over
3. File validation (images only)
4. Wraps entire application for full-page drop

**Props**:

```typescript
{
  children: React.ReactNode;      // App content
  onFileDrop: (files: File[]) => void;  // Callback for dropped files
}
```

**Features**:

- `useDrop()` hook from react-dnd
- Native HTML5 drag events as fallback
- Filters out non-image files
- Smooth visual transitions (300ms)

---

## Data Flow

### Upload Flow

```
User Action (Select/Drop files)
    ↓
handleFileSelect(files)
    ↓
For each file:
  ├─> Upload to /api/upload
  ├─> Create Object URL for preview
  └─> Add to images state
    ↓
UI updates with image grid
```

### Processing Flow

```
User clicks "Generate & Export CSV"
    ↓
handleGenerateMetadata()
    ↓
Validate initials input
    ↓
Set processing state (isProcessing=true)
    ↓
POST /api/process-batch { initials }
    ↓
Backend processes all images
    ↓
Receive { metadataList, csvFileName }
    ↓
Update images with metadata
    ↓
POST /api/export-csv { csvFileName }
    ↓
Download CSV automatically
    ↓
Set processing state (isProcessing=false)
```

### Cleanup Flow

```
User clicks "Clear" OR component unmounts
    ↓
handleClear()
    ↓
For each image:
  └─> URL.revokeObjectURL(preview)  // Free memory
    ↓
POST /api/cleanup
    ↓
Clear images state
Clear initials state
Reset file input
```

---

## API Integration

### Fetch API Usage

All requests use native `fetch()` with async/await:

```typescript
// Example: Batch processing
const response = await fetch('/api/process-batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ initials }),
});

if (!response.ok) {
  throw new Error('Failed to process images');
}

const result = await response.json();
```

**Error Handling**:

```typescript
try {
  // API call
} catch (error) {
  console.error('Error:', error);
  alert('Error message to user');
} finally {
  setProcessing({ isProcessing: false, ...});
}
```

### API Endpoints Used

| Endpoint             | Method | Purpose            | Request Body     |
| -------------------- | ------ | ------------------ | ---------------- |
| `/api/upload`        | POST   | Upload single file | FormData (image) |
| `/api/process-batch` | POST   | Generate metadata  | `{initials}`     |
| `/api/export-csv`    | POST   | Download CSV       | `{csvFileName}`  |
| `/api/cleanup`       | POST   | Clean temp files   | (empty)          |

---

## Supabase Integration (Epic 6)

### Client Setup

```typescript
// client/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### Auth Context

```typescript
// client/src/contexts/AuthContext.tsx
interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

// AuthProvider wraps app, listens to supabase.auth.onAuthStateChange()
// useAuth() hook provides auth state to any component
```

### Database Queries

```typescript
// Profile
supabase.from('profiles').select().eq('id', user.id).single();
supabase.from('profiles').update({ full_name, default_initials });

// History
supabase
  .from('processing_batches')
  .select()
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });

// Usage
supabase.from('usage_tracking').select().eq('user_id', user.id).eq('month_year', currentMonth);
```

### Environment Variables (Frontend)

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_FEATURE_PLANS_PAGE=false
```

---

## State Management

### Strategy: React Hooks (useState) + Auth Context

**Rationale**:

- Simple application with localized state for upload flow
- Auth state managed via React Context (Supabase AuthProvider)
- No need for global state management (Redux, Zustand)
- React 19 automatic batching handles updates efficiently

**State Categories**:

1. **Images State** (`useState<UploadedImage[]>`)
   - Core application data
   - Updated on upload, metadata generation, clear
   - Drives UI rendering (grid, buttons, progress)

2. **Form State** (`useState<string>`)
   - User initials input
   - Simple controlled component pattern

3. **UI State** (`useState<boolean>`)
   - `isDragging`: Drag over feedback
   - Updated on drag events

4. **Processing State** (`useState<ProcessingState>`)
   - `isProcessing`: Disable buttons, show progress
   - `currentIndex`: Progress calculation
   - `currentFileName`: Display current file

### State Updates

**Immutable Update Pattern**:

```typescript
// Adding images
setImages((prev) => [...prev, ...newImages]);

// Updating images with metadata
const updatedImages = images.map((img) => {
  const metadata = metadataList.find(m => m.fileName === img.file.name);
  if (metadata) {
    return { ...img, title: metadata.title, ... };
  }
  return img;
});
setImages(updatedImages);

// Removing image
setImages(images.filter((img) => img.id !== imageId));
```

---

## UI/UX Design System

### Design Philosophy

**Minimalist Glassmorphism**:

- Frosted glass aesthetic with backdrop blur
- Grain texture overlay for depth
- Subtle gradients and shadows
- Smooth animations and transitions
- High contrast for accessibility

### Color Palette

```typescript
// Backgrounds
'bg-gradient-to-br from-[#fafafa] via-[#f5f5f5] to-[#efefef]';

// Foreground
'text-foreground'; // Black with varying opacity

// Accents
'bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a]'; // Buttons

// Borders
'border-border/20'; // Subtle borders
```

### Custom Effects

#### Grain Effect

```css
/* index.css */
.grain::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url('data:image/svg+xml,...');
  opacity: 0.04;
  pointer-events: none;
  z-index: 100;
}
```

#### Glassmorphism

```css
.grain-gradient {
  background: linear-gradient(...);
  backdrop-filter: blur(12px);
  border: 2px solid rgba(255, 255, 255, 0.2);
}
```

#### Lava Button

```css
.lava-button {
  background: linear-gradient(...);
  transition:
    transform 0.3s,
    box-shadow 0.3s;
}

.lava-button:hover {
  transform: scale(1.03);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.lava-button:active {
  transform: scale(0.98);
}
```

### Typography

```typescript
// Headings
'text-[clamp(2.5rem,5vw,4rem)]'; // Fluid sizing
'tracking-[-0.04em]'; // Tight letter spacing
'leading-[1.1]'; // Tight line height

// Body
'text-[1rem]';
'tracking-[-0.01em]';

// Small
'text-[0.875rem]';
'opacity-40';
```

### Responsive Design

```typescript
// Grid
'grid grid-cols-4 gap-4'; // 4-column image grid

// Fluid typography
'text-[clamp(2.5rem,5vw,4rem)]';

// Max widths
'max-w-5xl'; // Main content
'max-w-3xl'; // Forms and inputs
```

---

## Performance Optimizations

### Image Preview Management

**Object URL Creation**:

```typescript
const preview = URL.createObjectURL(file);
```

**Memory Management**:

```typescript
// Cleanup on remove
URL.revokeObjectURL(image.preview);

// Cleanup on unmount
useEffect(() => {
  return () => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
  };
}, []);
```

### React Optimizations

1. **Functional Components**: All components use hooks (no classes)
2. **Key Props**: Stable IDs for list rendering
3. **Conditional Rendering**: Avoid unnecessary DOM updates
4. **Event Delegation**: Single drag handler on root

### Build Optimizations (Vite)

- **Code Splitting**: Automatic by Vite
- **Tree Shaking**: Dead code elimination
- **Minification**: Production builds minified
- **Asset Optimization**: Images and CSS optimized

---

## Accessibility

### WCAG AA Compliance

**Semantic HTML**:

- `<button>` for interactive elements
- `<label>` associated with `<input>`
- Proper heading hierarchy

**Keyboard Navigation**:

- Tab order follows visual flow
- Enter key on buttons
- Escape to close (if modal added)

**Screen Reader Support**:

- Alt text for images: `alt={image.file.name}`
- ARIA labels where needed
- Form labels properly associated

**Color Contrast**:

- Text meets 4.5:1 ratio
- Focus indicators high contrast
- Disabled states clear

**Focus Management**:

```css
focus:border-foreground/20
focus:ring-2 focus:ring-foreground/10
```

---

## Error Handling

### User-Facing Errors

```typescript
try {
  // API operation
} catch (error) {
  console.error('Error:', error);
  alert('Error generating metadata. Please try again.');
}
```

**Improvement Opportunities**:

- Replace `alert()` with toast notifications (Sonner)
- Display errors inline near relevant UI
- Provide actionable error messages
- Implement retry logic

### Validation

**Client-Side Validation**:

```typescript
// File type
const imageFiles = files.filter(file => file.type.startsWith('image/'));

// Initials required
if (!initials) {
  alert('Please enter your initials');
  return;
}

// Max length
<Input maxLength={5} />
```

---

## Testing Strategy

### Unit Testing (Vitest)

**Test Files**:

- Component tests
- Utility function tests
- API integration tests

**Example Test**:

```typescript
describe('App Component', () => {
  it('should upload files', async () => {
    render(<App />);
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    // ... test logic
  });
});
```

### Integration Testing

**Server Integration**:

- Test API endpoints with Supertest
- Mock external services (Cloudinary, OpenAI)
- Validate request/response formats

---

## Build & Deployment

### Development

```bash
npm run dev:client
# → vite (port 5173)
# Hot Module Replacement (HMR)
# Proxy /api → localhost:3000
```

### Production Build

```bash
npm run build
# → vite build
# Output: dist/
#   - index.html
#   - assets/index-[hash].js
#   - assets/index-[hash].css
```

**Build Configuration** (`vite.config.ts`):

```typescript
{
  root: 'client',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: { '@': './client/src' },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}
```

---

## Future Enhancements

### Recommended Improvements

1. **Real-Time Progress** (See IMPROVEMENT_PLAN.md)
   - Replace progress bar with live updates
   - Show per-image status
   - Use Server-Sent Events or WebSocket

2. **Queue Visualization**
   - Display processing queue
   - Show individual image states
   - Retry failed images

3. **Toast Notifications**
   - Replace `alert()` with Sonner toasts
   - Success/error/info messages
   - Non-blocking UI

4. **Settings Panel**
   - Batch size configuration
   - Quality settings
   - Export options

5. **Command Palette**
   - Quick actions (Cmd+K)
   - Keyboard shortcuts
   - Help search

---

## Component Inventory

**Currently Used**:

- Input (1x)
- Label (1x)
- Progress (1x)
- Custom buttons (7x)

**Available (shadcn/ui)**:

- 44 additional components ready for use
- See `ui-component-inventory-client.md` for full list

---

## Dependencies

### Production Dependencies

```json
{
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-router-dom": "^6.x",
  "react-dnd": "^16.0.1",
  "react-dnd-html5-backend": "^16.0.1",
  "@supabase/supabase-js": "^2.x",
  "@radix-ui/react-label": "^2.1.8",
  "@radix-ui/react-progress": "^1.1.8",
  "@radix-ui/react-slot": "^1.2.4",
  "lucide-react": "^0.553.0",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.3.1"
}
```

### Dev Dependencies

```json
{
  "@vitejs/plugin-react-swc": "^4.2.1",
  "vite": "^7.2.2",
  "typescript": "^5.8.2"
}
```

---

**Architecture Type**: Component-Based SPA with Client-Side Routing
**Build Tool**: Vite 7.2.2
**Routing**: React Router v6 (`createBrowserRouter`)
**Auth**: Supabase Auth (email/password, JWT, session management)
**Database**: Supabase (PostgreSQL + RLS)
**Styling**: Tailwind CSS + Custom Design System
**State Management**: React Hooks (useState) + Auth Context (Supabase)

**Last Updated**: March 26, 2026 (Epic 6 restructure — React Router, Supabase, Figma integration)
