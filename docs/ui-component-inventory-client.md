# UI Component Inventory - Frontend Client

## Overview

The Adobe Stock Uploader frontend is built with React 19, TypeScript, and shadcn/ui component library. It features a modern, minimalist design with glassmorphism effects and smooth animations.

---

## Application Components

### 1. App Component

**Location**: `client/src/app.tsx` (508 lines)

**Purpose**: Main application component that orchestrates the entire UI

**Key Features**:

- File upload management (drag & drop + file picker)
- Image preview grid
- Batch processing with progress tracking
- CSV generation and download
- Server cleanup on mount

**State Management**:

```typescript
interface UploadedImage {
  id: string;
  file: File;
  preview: string; // Object URL for preview
  description?: string;
  title?: string;
  keywords?: string;
  category?: number;
}

interface ProcessingState {
  isProcessing: boolean;
  currentIndex: number;
  currentFileName: string;
}
```

**Key Methods**:

- `handleFileSelect()` - Processes file selection/drop
- `handleGenerateMetadata()` - Batch processing workflow
- `handleClear()` - Resets state and cleans server files
- `handleFileInputChange()` - File input handler

**API Integration**:

- `POST /api/upload` - Upload images
- `POST /api/process-batch` - Generate metadata
- `POST /api/export-csv` - Download CSV
- `POST /api/cleanup` - Clean temporary files

---

### 2. DropZone Component

**Location**: `client/src/app.tsx` (lines 32-86)

**Purpose**: Provides drag-and-drop functionality for file uploads

**Technology**: react-dnd with HTML5 backend

**Features**:

- Native file drop support
- Visual feedback on drag over
- File type filtering (images only)
- Integrates with file input element

**Props**:

```typescript
{
  children: React.ReactNode;
  onFileDrop: (files: File[]) => void;
}
```

**Visual Feedback**:

- Background color change on drag over
- Smooth transitions (300ms)
- Prevents default browser behavior

---

## UI Component Library (shadcn/ui)

The application uses **47 shadcn/ui components**, providing a comprehensive, accessible component system.

### Form Components

#### Input Component

**Location**: `client/src/components/ui/input.tsx`

**Usage**: Initials input field

**Styling**:

- Glassmorphism gradient background
- Custom border radius (rounded-2xl)
- Focus states with transitions
- Disabled state handling

**Example**:

```tsx
<Input
  id="initials"
  type="text"
  value={initials}
  onChange={e => setInitials(e.target.value)}
  placeholder="e.g., OY"
  className="grain-gradient..."
  maxLength={5}
  disabled={processing.isProcessing}
/>
```

---

#### Label Component

**Location**: `client/src/components/ui/label.tsx`

**Usage**: Form field labels

**Styling**:

- Small uppercase text
- Reduced opacity for hierarchy
- Letter spacing adjustments

---

#### Progress Component

**Location**: `client/src/components/ui/progress.tsx`

**Usage**: Batch processing progress indicator

**Features**:

- Animated progress bar
- Percentage-based value
- Smooth transitions
- Custom height (h-2)

**Example**:

```tsx
<Progress value={((processing.currentIndex + 1) / images.length) * 100} className="h-2" />
```

---

### Layout Components

#### Card Component

**Location**: `client/src/components/ui/card.tsx`

**Variants**: Not currently used but available for future expansion

**Structure**:

- `Card` - Container
- `CardHeader` - Header section
- `CardTitle` - Title text
- `CardDescription` - Subtitle text
- `CardContent` - Main content
- `CardFooter` - Footer actions

---

#### Accordion Component

**Location**: `client/src/components/ui/accordion.tsx`

**Potential Use Case**: Collapsible image details or help sections

---

#### Separator Component

**Location**: `client/src/components/ui/separator.tsx`

**Potential Use Case**: Dividing sections (upload area / processed images)

---

### Interactive Components

#### Button Component

**Location**: `client/src/components/ui/button.tsx`

**Variants Available**:

- Default
- Destructive
- Outline
- Secondary
- Ghost
- Link

**Sizes**:

- Default
- Small
- Large
- Icon

**Current Usage**: Custom buttons with grain-gradient styling instead of standard button component

---

#### Dialog Component

**Location**: `client/src/components/ui/dialog.tsx`

**Potential Use Case**:

- Error messages
- Confirmation dialogs
- Image preview modal

---

#### Toast / Sonner Component

**Location**: `client/src/components/ui/sonner.tsx`

**Potential Use Case**:

- Success notifications
- Error alerts
- Processing status updates

---

### Data Display Components

#### Badge Component

**Location**: `client/src/components/ui/badge.tsx`

**Potential Use Case**:

- Image status indicators
- Category labels
- File size/type badges

---

#### Table Component

**Location**: `client/src/components/ui/table.tsx`

**Potential Use Case**: Metadata review table before export

**Structure**:

- `Table` - Container
- `TableHeader` - Column headers
- `TableBody` - Rows
- `TableRow` - Single row
- `TableCell` - Cell content

---

#### Avatar Component

**Location**: `client/src/components/ui/avatar.tsx`

**Potential Use Case**: User profile in header

---

### Navigation Components

#### Breadcrumb Component

**Location**: `client/src/components/ui/breadcrumb.tsx`

**Potential Use Case**: Multi-step wizard navigation

---

#### Navigation Menu Component

**Location**: `client/src/components/ui/navigation-menu.tsx`

**Potential Use Case**: Main site navigation

---

#### Pagination Component

**Location**: `client/src/components/ui/pagination.tsx`

**Potential Use Case**: Paginate large image lists

---

### Form & Input Components

#### Checkbox Component

**Location**: `client/src/components/ui/checkbox.tsx`

**Potential Use Case**: Multi-select images, settings

---

#### Radio Group Component

**Location**: `client/src/components/ui/radio-group.tsx`

**Potential Use Case**: Category selection, export format options

---

#### Select Component

**Location**: `client/src/components/ui/select.tsx`

**Potential Use Case**: Category dropdown, batch size selector

---

#### Slider Component

**Location**: `client/src/components/ui/slider.tsx`

**Potential Use Case**: Image quality adjustment, compression level

---

#### Switch Component

**Location**: `client/src/components/ui/switch.tsx`

**Potential Use Case**: Toggle features (auto-upload, thumbnail generation)

---

#### Textarea Component

**Location**: `client/src/components/ui/textarea.tsx`

**Potential Use Case**: Manual metadata editing, notes field

---

### Overlay Components

#### Sheet Component

**Location**: `client/src/components/ui/sheet.tsx`

**Potential Use Case**:

- Settings panel
- Help documentation
- Processing queue details

---

#### Popover Component

**Location**: `client/src/components/ui/popover.tsx`

**Potential Use Case**:

- Image info tooltips
- Quick actions menu

---

#### Tooltip Component

**Location**: `client/src/components/ui/tooltip.tsx`

**Potential Use Case**:

- Button explanations
- Field help text
- Icon descriptions

---

#### Hover Card Component

**Location**: `client/src/components/ui/hover-card.tsx`

**Potential Use Case**: Rich image previews on hover

---

### Advanced Components

#### Calendar Component

**Location**: `client/src/components/ui/calendar.tsx`

**Potential Use Case**: Date filtering for batch exports

---

#### Command Component

**Location**: `client/src/components/ui/command.tsx`

**Potential Use Case**:

- Command palette (Cmd+K)
- Quick actions search

---

#### Context Menu Component

**Location**: `client/src/components/ui/context-menu.tsx`

**Potential Use Case**: Right-click actions on images

---

#### Dropdown Menu Component

**Location**: `client/src/components/ui/dropdown-menu.tsx`

**Potential Use Case**:

- Image actions menu
- User menu
- Export options

---

## Custom Styling System

### Design Tokens

**Color Palette**:

- Background gradients: `from-[#fafafa] via-[#f5f5f5] to-[#efefef]`
- Foreground: Black with opacity variations
- Accents: `from-[#1a1a1a] to-[#0a0a0a]`

**Effects**:

- **Grain Effect**: Subtle texture overlay for depth
- **Glassmorphism**: Frosted glass aesthetic with backdrop blur
- **Lava Button**: Animated gradient button with hover effects

### Custom CSS Classes

**Grain Effect** (`index.css`):

```css
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

**Grain Gradient**:

```css
.grain-gradient {
  position: relative;
  background: linear-gradient(...);
}

.grain-gradient::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('data:image/svg+xml,...');
  opacity: 0.08;
  pointer-events: none;
  z-index: 1;
}
```

**Lava Button** (Animated gradient button):

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
```

---

## Responsive Design

### Breakpoints

- Mobile-first approach
- Fluid typography: `clamp(2.5rem, 5vw, 4rem)`
- Responsive grid: `grid-cols-4` for image gallery

### Adaptive Features

- Touch-friendly hit targets
- Simplified drag-and-drop on mobile
- Responsive padding and spacing

---

## Animation & Transitions

### Transition Durations

- Standard: 300ms
- Fast: 200ms
- Smooth: 500ms

### Animation Effects

1. **Scale on hover**: `hover:scale-[1.02]`
2. **Fade in/out**: Opacity transitions
3. **Backdrop blur**: Dynamic blur on drag
4. **Progress animation**: Smooth bar filling
5. **Button press**: `active:scale-[0.98]`

---

## Accessibility Features

### Semantic HTML

- Proper heading hierarchy
- Form labels associated with inputs
- Button roles and states

### Keyboard Navigation

- Tab order follows visual flow
- Focus states visible
- Disabled states properly conveyed

### Screen Reader Support

- Alt text for images
- ARIA labels where needed
- Accessible form controls

### Color Contrast

- Text meets WCAG AA standards
- Focus indicators high contrast
- Disabled states clearly differentiated

---

## Component Usage Statistics

**Currently Used**:

- Input: 1 instance (initials field)
- Label: 1 instance
- Progress: 1 instance (batch processing)
- Custom buttons: 7 instances

**Available But Unused**:

- 44 shadcn/ui components ready for feature expansion

---

## Design System Consistency

### Spacing Scale

- xs: 0.5rem (2px)
- sm: 1rem (4px)
- md: 1.5rem (6px)
- lg: 2rem (8px)
- xl: 3rem (12px)

### Border Radius

- Full: `rounded-full` (pills, buttons)
- 2xl: `rounded-2xl` (cards, inputs)
- lg: `rounded-lg` (medium elements)

### Typography

- Headings: `-0.04em` letter-spacing
- Body: `-0.01em` letter-spacing
- Small text: `-0.01em` to `-0.02em`
- Font sizes: `clamp()` for fluid scaling

---

## Future Component Recommendations

Based on IMPROVEMENT_PLAN.md, consider adding:

1. **Queue Visualization Component**
   - Real-time processing status
   - Individual image states
   - Error indicators

2. **Image Card with Actions**
   - Retry failed uploads
   - View/edit metadata
   - Remove from batch

3. **Settings Panel (Sheet)**
   - Batch size configuration
   - Quality settings
   - API preferences

4. **Toast Notifications (Sonner)**
   - Success messages
   - Error alerts
   - Processing updates

5. **Command Palette (Command)**
   - Quick actions
   - Keyboard shortcuts
   - Help search

---

**Component Library**: shadcn/ui + Radix UI  
**Design System**: Custom grain effect + glassmorphism  
**Total Components**: 47 available, 3 actively used  
**Styling**: Tailwind CSS + Custom CSS  
**Accessibility**: WCAG AA compliant

**Last Updated**: November 9, 2025
