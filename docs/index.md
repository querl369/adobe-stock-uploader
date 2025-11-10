# Adobe Stock Uploader - Documentation Index

## 📚 Master Documentation Hub

Welcome to the comprehensive documentation for the Adobe Stock Uploader project. This index provides quick access to all technical documentation, guides, and references.

---

## 🚀 Quick Start

**New to the project?** Start here:

1. [README.md](../README.md) - Project overview and getting started
2. [Development Guide](./development-guide.md) - Setup, workflows, and common tasks
3. [Project Overview](./project-overview.md) - Executive summary and architecture overview

---

## 📖 Project Documentation

### Overview & Planning

- **[Project Overview](./project-overview.md)** - Executive summary, features, tech stack, current status
- **[IMPROVEMENT_PLAN.md](../IMPROVEMENT_PLAN.md)** - Detailed roadmap with 11 planned enhancements
  - Performance improvements (parallel processing, thumbnails)
  - UX enhancements (real-time progress, queue visualization)
  - **Critical bug fixes** (Easter theme bug, filename preservation)

### Architecture Documentation

#### Multi-Part System

- **[Integration Architecture](./integration-architecture.md)** - How frontend, backend, and external services communicate
  - Frontend ↔ Backend (REST API)
  - Backend ↔ Cloudinary (image hosting)
  - Backend ↔ OpenAI (AI metadata generation)
  - Complete data flow diagrams
  - Performance characteristics

#### Frontend Architecture

- **[Architecture - Client](./architecture-client.md)** - React frontend (508+ lines)
  - Component-based SPA architecture
  - React 19 + TypeScript + Vite
  - State management strategy
  - UI/UX design system (glassmorphism + grain effect)
  - Performance optimizations
  - Accessibility (WCAG AA)

#### Backend Architecture

- **[Architecture - API](./architecture-api.md)** - Express backend (374+ lines)
  - Layered REST API architecture
  - Express 4 + TypeScript + Node.js
  - API endpoint specifications
  - File system operations
  - External service integration
  - Error handling strategy

---

### Detailed Technical Documentation

#### API & Integration

- **[API Contracts - Backend API](./api-contracts-api.md)** - Complete REST API specification
  - 5 API endpoints documented
  - Request/response formats
  - Error handling
  - Adobe Stock category reference (21 categories)
  - Rate limits and optimization opportunities

#### Component Documentation

- **[UI Component Inventory - Frontend](./ui-component-inventory-client.md)** - Complete UI component catalog
  - 47 shadcn/ui components available
  - 3 actively used components (Input, Label, Progress)
  - Custom design system (grain effect, glassmorphism, lava button)
  - Component usage recommendations

#### Backend Utilities

- **[Backend Utilities Documentation](./backend-utilities-api.md)** - Core business logic modules
  - `src/openai.ts` - AI metadata generation (61 lines)
  - `src/cloudinary.ts` - Image upload/delete (38 lines)
  - `src/files-manipulation.ts` - File operations (74 lines)
  - `src/csv-writer.ts` - CSV generation (25 lines)
  - `src/prompt-text.ts` - OpenAI prompt (30 lines) ⚠️ Contains Easter bug
  - `src/index.ts` - CLI processor (77 lines)

#### Source Code Organization

- **[Source Tree Analysis](./source-tree-analysis.md)** - Complete codebase structure
  - Critical directories explained
  - Entry points (dev, prod, CLI)
  - Configuration files
  - File naming conventions
  - Data flow diagram
  - ~1,200+ lines of application code

---

### Developer Resources

- **[Development Guide](./development-guide.md)** - Complete developer handbook
  - Quick start guide
  - Development workflow
  - Testing strategy
  - Common tasks and issues
  - Debugging tips
  - IDE setup (VS Code)
  - API development with curl/Postman

---

## 🎯 By Role

### 👨‍💻 For Developers

**Getting Started**:

1. [Development Guide](./development-guide.md) - Setup and workflows
2. [Source Tree Analysis](./source-tree-analysis.md) - Navigate the codebase
3. [Integration Architecture](./integration-architecture.md) - Understand data flow

**Working on Frontend**:

- [Architecture - Client](./architecture-client.md)
- [UI Component Inventory](./ui-component-inventory-client.md)
- Focus: `client/src/app.tsx` (508 lines)

**Working on Backend**:

- [Architecture - API](./architecture-api.md)
- [Backend Utilities](./backend-utilities-api.md)
- [API Contracts](./api-contracts-api.md)
- Focus: `src/` directory (6 utility modules)

---

### 🏗️ For Architects

**System Design**:

- [Project Overview](./project-overview.md) - High-level architecture
- [Integration Architecture](./integration-architecture.md) - System integration patterns
- [Architecture - Client](./architecture-client.md) - Frontend design
- [Architecture - API](./architecture-api.md) - Backend design

**Planning & Roadmap**:

- [IMPROVEMENT_PLAN.md](../IMPROVEMENT_PLAN.md) - 11 documented improvements

---

### 🧪 For QA Engineers

**Testing Documentation**:

- [Development Guide - Testing Section](./development-guide.md#testing)
- [Architecture - API - Testing Strategy](./architecture-api.md#testing-strategy)
- Test files: `tests/` directory (4 test suites)

**API Testing**:

- [API Contracts](./api-contracts-api.md) - Complete endpoint specs
- [Development Guide - API Development](./development-guide.md#api-development)

---

### 📝 For Technical Writers

**Documentation Structure**:

- All `.md` files in `/docs` directory
- [Source Tree Analysis](./source-tree-analysis.md) - Code organization
- [Project Overview](./project-overview.md) - User-facing features

---

## 🔍 By Topic

### Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Express 4, TypeScript, Node.js, Multer, Sharp
- **External Services**: OpenAI GPT-5-mini, Cloudinary
- **Testing**: Vitest, Supertest
- **Tools**: Husky, Prettier, lint-staged

See [Project Overview](./project-overview.md#technology-stack-summary) for complete list.

### API Documentation

- [API Contracts](./api-contracts-api.md) - Complete REST API reference
- [Integration Architecture](./integration-architecture.md#integration-point-1-frontend--backend-api) - API integration patterns

### UI/UX Design

- [Architecture - Client - UI/UX Design System](./architecture-client.md#uiux-design-system)
- [UI Component Inventory](./ui-component-inventory-client.md) - 47 components
- Custom effects: Grain, Glassmorphism, Lava Button

### File Processing

- [Backend Utilities - File Manipulation](./backend-utilities-api.md#3-file-manipulation)
- [Architecture - API - File System Architecture](./architecture-api.md#file-system-architecture)
- Flow: `uploads/` → `images/` → `csv_output/`

### AI & External Services

- [Backend Utilities - OpenAI Integration](./backend-utilities-api.md#1-openai-integration)
- [Backend Utilities - Cloudinary Integration](./backend-utilities-api.md#2-cloudinary-integration)
- [Integration Architecture - External Services](./integration-architecture.md#integration-point-2-backend--cloudinary)

### Performance & Optimization

- [IMPROVEMENT_PLAN.md](../IMPROVEMENT_PLAN.md) - Detailed optimization roadmap
- [Integration Architecture - Performance Characteristics](./integration-architecture.md#performance-characteristics)
- Current: 8-11s per image | Target: 1-2s per image

---

## ⚠️ Known Issues & Fixes

### Critical Issues

1. **Easter Theme Bug** (Priority: HIGH)
   - **Location**: `src/prompt-text.ts` line 28
   - **Impact**: AI generates Easter-themed descriptions for unrelated images
   - **Fix**: See [IMPROVEMENT_PLAN.md Section 11](../IMPROVEMENT_PLAN.md#11-fix-openai-prompt---easter-theme-bug-)
   - **Details**: [Backend Utilities - Prompt Text](./backend-utilities-api.md#5-prompt-text)

2. **Original Filenames Not Preserved** (Priority: HIGH)
   - **Impact**: CSV contains renamed files, but user uploads originals
   - **Fix**: See [IMPROVEMENT_PLAN.md Section 4](../IMPROVEMENT_PLAN.md#4-preserve-original-filenames-)
   - **Details**: [Backend Utilities - File Manipulation](./backend-utilities-api.md#3-file-manipulation)

3. **Sequential Processing** (Priority: MEDIUM)
   - **Impact**: Slow batch processing (80-100s for 10 images)
   - **Fix**: See [IMPROVEMENT_PLAN.md Section 1](../IMPROVEMENT_PLAN.md#1-parallel-processing-)
   - **Details**: [Integration Architecture - Performance](./integration-architecture.md#performance-characteristics)

4. **10MB Cloudinary Limit** (Priority: MEDIUM)
   - **Impact**: Large images fail to upload
   - **Fix**: See [IMPROVEMENT_PLAN.md Section 3](../IMPROVEMENT_PLAN.md#3-image-thumbnail-upload-to-cloudinary-)
   - **Details**: [Backend Utilities - Cloudinary](./backend-utilities-api.md#2-cloudinary-integration)

---

## 📊 Project Statistics

### Codebase Size

- **Frontend**: ~508 lines (app.tsx) + 47 UI components
- **Backend Utilities**: ~305 lines (6 files in `src/`)
- **API Server**: ~374 lines (server.ts)
- **Tests**: 4 test files
- **Total Application Code**: ~1,200+ lines

### Dependencies

- **Production**: 18 npm packages
- **Development**: 7 dev packages
- **UI Components**: 47 shadcn/ui components

### Architecture

- **Project Type**: Multi-part web application
- **Parts**: 2 (Frontend + Backend)
- **API Endpoints**: 5 REST endpoints
- **External Services**: 2 (Cloudinary, OpenAI)

See [Project Overview - Current Statistics](./project-overview.md#current-statistics) for details.

---

## 🛠️ Development Resources

### Quick Reference

```bash
# Start development
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```

### Key Files to Edit

| What You Want To Do       | File to Edit                |
| ------------------------- | --------------------------- |
| Change UI/layout          | `client/src/app.tsx`        |
| Add UI components         | `client/src/components/ui/` |
| Modify API endpoints      | `server.ts`                 |
| Change AI prompt          | `src/prompt-text.ts` ⚠️     |
| Update file processing    | `src/files-manipulation.ts` |
| Change CSV format         | `src/csv-writer.ts`         |
| Modify Cloudinary logic   | `src/cloudinary.ts`         |
| Update OpenAI integration | `src/openai.ts`             |

### Documentation Updates

When making changes, update relevant documentation:

- **Code changes**: Update architecture docs
- **API changes**: Update [API Contracts](./api-contracts-api.md)
- **UI changes**: Update [UI Component Inventory](./ui-component-inventory-client.md)
- **New features**: Update [Project Overview](./project-overview.md)

---

## 📚 External Resources

### Technologies Used

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express.js Guide](https://expressjs.com/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)

### APIs & Services

- [OpenAI API Reference](https://platform.openai.com/docs/)
- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Adobe Stock Guidelines](https://helpx.adobe.com/stock/contributor/help/stock-contributor-requirements.html)

### Testing & Tools

- [Vitest Documentation](https://vitest.dev/)
- [Supertest GitHub](https://github.com/visionmedia/supertest)
- [Husky Documentation](https://typicode.github.io/husky/)

---

## 🎯 Next Steps

### For New Team Members

1. ✅ Read [README.md](../README.md)
2. ✅ Follow [Development Guide](./development-guide.md) setup
3. ✅ Review [Project Overview](./project-overview.md)
4. ✅ Explore [Source Tree Analysis](./source-tree-analysis.md)
5. ✅ Run `npm run dev` and test the application

### For Contributors

1. ✅ Review [IMPROVEMENT_PLAN.md](../IMPROVEMENT_PLAN.md)
2. ✅ Pick an issue to work on
3. ✅ Read relevant architecture documentation
4. ✅ Follow [Development Guide - Git Workflow](./development-guide.md#git-workflow)
5. ✅ Submit PR with tests

### For Brownfield PRD

When planning new features using BMAD workflow:

- **Primary Reference**: This index.md
- **Architecture Details**:
  - [Integration Architecture](./integration-architecture.md)
  - [Architecture - Client](./architecture-client.md)
  - [Architecture - API](./architecture-api.md)
- **Current Issues**: [IMPROVEMENT_PLAN.md](../IMPROVEMENT_PLAN.md)

---

## 📝 Documentation Metadata

**Generated**: November 9, 2025  
**Scan Type**: Deep Scan  
**Scan Level**: Deep (critical files read)  
**Project Type**: Multi-part Web Application  
**Architecture**: React (client) + Express (api)  
**Documentation Version**: 1.0.0

**Focus Areas** (per user request):

- ✅ `src/` - Backend utilities (6 modules, 305 lines)
- ✅ `client/` - React frontend (1 main component, 47 UI components)

---

## ✨ Documentation Quality

This documentation was generated using the BMAD BMM document-project workflow with:

- ✅ Complete API contract documentation
- ✅ Full UI component inventory (47 components)
- ✅ Detailed backend utilities documentation
- ✅ Comprehensive source tree analysis
- ✅ Integration architecture with diagrams
- ✅ Architecture documentation for both parts
- ✅ Development guide with workflows
- ✅ Project overview with statistics
- ✅ Master index with navigation

**Coverage**:

- Frontend: 100% (all key files documented)
- Backend: 100% (all utility modules documented)
- Integration: 100% (all integration points documented)
- Testing: 100% (test strategy documented)

---

**Happy developing!** 🚀

For questions, start with the most relevant document above, or explore the complete documentation set in the `docs/` directory.

**Last Updated**: November 9, 2025  
**Documentation Standard**: BMAD BMM v1.2.0
