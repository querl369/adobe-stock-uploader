# Development Guide

## Quick Start

### Prerequisites

- **Node.js**: v20.0.0 or higher
- **npm**: v8.0.0 or higher
- **Git**: Latest version
- **Code Editor**: VS Code recommended (with TypeScript support)

### Initial Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd adobe-stock-uploader

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
```

### Environment Configuration

Create `.env` file in the project root:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-key-here

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

**Getting API Keys**:

1. **OpenAI**: https://platform.openai.com/api-keys
2. **Cloudinary**: https://cloudinary.com/users/register/free

---

## Development Workflow

### Running the Application

**Option 1: Run Both (Frontend + Backend)**

```bash
npm run dev
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
```

**Option 2: Run Separately**

```bash
# Terminal 1 - Frontend
npm run dev:client

# Terminal 2 - Backend
npm run dev:server
```

### Project Scripts

| Script          | Command                 | Purpose                        |
| --------------- | ----------------------- | ------------------------------ |
| `dev`           | `npm run dev`           | Run both frontend and backend  |
| `dev:client`    | `npm run dev:client`    | Run frontend dev server (Vite) |
| `dev:server`    | `npm run dev:server`    | Run backend server (ts-node)   |
| `build`         | `npm run build`         | Build frontend for production  |
| `start`         | `npm start`             | Build + run production server  |
| `test`          | `npm test`              | Run test suite                 |
| `test:watch`    | `npm run test:watch`    | Run tests in watch mode        |
| `test:ui`       | `npm run test:ui`       | Run tests with UI              |
| `test:coverage` | `npm run test:coverage` | Generate coverage report       |

---

## Project Structure for Developers

### Key Directories

```
adobe-stock-uploader/
├── client/                  # Frontend React app
│   ├── src/
│   │   ├── app.tsx         # ⭐ Main component (focus here)
│   │   ├── components/ui/  # shadcn/ui components
│   │   ├── index.css       # Global styles + grain effect
│   │   └── main.tsx        # Entry point
│   └── index.html          # HTML template
│
├── src/                     # ⭐ Backend utilities (focus here)
│   ├── openai.ts           # AI metadata generation
│   ├── cloudinary.ts       # Image hosting
│   ├── files-manipulation.ts  # File operations
│   ├── csv-writer.ts       # CSV generation
│   ├── prompt-text.ts      # ⚠️ OpenAI prompt (Easter bug)
│   └── index.ts            # CLI processor
│
├── server.ts                # Express API server
├── tests/                   # Test files
├── uploads/                 # Temp uploads (gitignored)
├── images/                  # Processing dir (gitignored)
└── csv_output/              # Generated CSVs (gitignored)
```

### Configuration Files

```
├── vite.config.ts           # Vite (frontend) configuration
├── tsconfig.json            # TypeScript (backend) config
├── tsconfig.client.json     # TypeScript (frontend) config
├── vitest.config.ts         # Test framework config
├── package.json             # Dependencies & scripts
└── .env                     # Environment variables (not in git)
```

---

## Development Guidelines

### Code Style

**TypeScript Configuration**:

- Strict mode enabled
- ES2020 target
- CommonJS modules (backend)
- ESNext modules (frontend)

**Formatting**:

- Prettier for auto-formatting
- 2-space indentation
- Single quotes
- Trailing commas

**Pre-Commit Hooks** (Husky + lint-staged):

- Runs Vitest on changed files
- Auto-formats with Prettier
- Prevents commits with failing tests

### Commit Message Format

```
ASU-{short 10-15 word description}

Examples:
✅ ASU-Add parallel processing for batch uploads
✅ ASU-Fix Easter bug in OpenAI prompt
✅ ASU-Implement real-time progress with SSE
❌ fix bug
❌ update files
❌ WIP
```

### Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/parallel-processing

# 2. Make changes
# ... code ...

# 3. Run tests
npm test

# 4. Commit (pre-commit hooks run automatically)
git add .
git commit -m "ASU-Implement parallel image processing"

# 5. Push
git push origin feature/parallel-processing

# 6. Create Pull Request
```

---

## Testing

### Running Tests

```bash
# Run all tests once
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# UI mode (visual test runner)
npm run test:ui

# Coverage report
npm run test:coverage
```

### Test Files

| File                               | Purpose                        |
| ---------------------------------- | ------------------------------ |
| `tests/server.integration.test.ts` | API endpoint integration tests |
| `tests/openai.test.ts`             | OpenAI service tests           |
| `tests/csv-writer.test.ts`         | CSV generation tests           |
| `tests/files-manipulation.test.ts` | File operation tests           |

### Writing Tests

**Example Test**:

```typescript
import { describe, it, expect } from 'vitest';
import { writeMetadataToCSV } from '../src/csv-writer';

describe('writeMetadataToCSV', () => {
  it('should generate valid CSV', async () => {
    const metadata = [
      {
        filename: 'test.jpg',
        title: 'Test Image',
        keywords: 'test, image',
        category: 11,
        releases: 'OY',
      },
    ];

    await writeMetadataToCSV(metadata, 'test-output.csv');

    // Assert file exists and contains correct data
    expect(fs.existsSync('test-output.csv')).toBe(true);
  });
});
```

---

## Common Development Tasks

### Adding a New UI Component

```bash
# Use shadcn CLI to add components
npx shadcn-ui@latest add [component-name]

# Example: Add dialog component
npx shadcn-ui@latest add dialog

# Then import and use
import { Dialog } from '@/components/ui/dialog';
```

### Modifying API Endpoints

**Location**: `server.ts`

```typescript
// Add new endpoint
app.post('/api/my-endpoint', async (req, res) => {
  try {
    const { param } = req.body;

    // Your logic here

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Adding New Utility Functions

**Location**: `src/`

```typescript
// src/my-utility.ts
export async function myFunction(param: string): Promise<string> {
  // Implementation
  return result;
}

// Import in server.ts
const { myFunction } = require('./src/my-utility');
```

### Modifying OpenAI Prompt

**Location**: `src/prompt-text.ts`

⚠️ **Important**: Line 28 contains Easter bug. Remove when fixing.

```typescript
// src/prompt-text.ts
export const PROMPT_TEXT = `
Your updated prompt here...

Categories:
1. Animals
2. Buildings and Architecture
...
`;
```

---

## Debugging

### Frontend Debugging

**Browser DevTools**:

1. Open Chrome/Firefox DevTools (F12)
2. Sources tab → `client/src/app.tsx`
3. Set breakpoints
4. Reload page

**Console Logging**:

```typescript
console.log('Debug info:', variable);
console.error('Error:', error);
```

**React DevTools**:

- Install React DevTools extension
- Inspect component state and props

### Backend Debugging

**Console Logging**:

```typescript
console.log('🚀 Server starting...');
console.log('📥 Received request:', req.body);
console.error('❌ Error:', error);
```

**VS Code Debugger**:

1. Add breakpoints in code
2. Run "Debug Server" configuration
3. Step through code execution

**ts-node Debugging**:

```bash
# Run with inspect flag
node --inspect -r ts-node/register server.ts
```

---

## Common Issues & Solutions

### Issue 1: "Cannot find module"

**Cause**: Missing dependency or incorrect import

**Solution**:

```bash
npm install
# Or install specific package
npm install [package-name]
```

### Issue 2: "Port 3000 already in use"

**Cause**: Another process using port 3000

**Solution**:

```bash
# Find and kill process
lsof -i :3000
kill -9 [PID]

# Or use different port in server.ts
const PORT = 3001;
```

### Issue 3: "OPENAI_API_KEY not found"

**Cause**: Missing or incorrect .env file

**Solution**:

1. Check `.env` exists in project root
2. Verify `OPENAI_API_KEY=sk-...` is present
3. Restart server after changing .env

### Issue 4: "Cloudinary upload failed"

**Causes**:

- File > 10MB (free tier limit)
- Invalid API credentials
- Network issues

**Solutions**:

```bash
# Check file size
ls -lh images/

# Verify credentials in .env
cat .env | grep CLOUDINARY

# Test Cloudinary connection
# (Add test endpoint)
```

### Issue 5: "Easter theme in unrelated images"

**Cause**: Line 28 in `src/prompt-text.ts`

**Solution**:

```typescript
// Remove this line:
'It is Easter preparation image, provide category accordingly.';

// See IMPROVEMENT_PLAN.md Section 11 for full fix
```

---

## Performance Profiling

### Frontend Performance

**React DevTools Profiler**:

1. Open React DevTools
2. Go to Profiler tab
3. Click Record
4. Perform actions
5. Stop and analyze

**Vite Build Analysis**:

```bash
npm run build
# Check dist/ folder size
du -sh dist/
```

### Backend Performance

**Timing API Calls**:

```typescript
console.time('cloudinary-upload');
await uploadImage(filePath);
console.timeEnd('cloudinary-upload');
```

**Memory Usage**:

```typescript
console.log('Memory:', process.memoryUsage());
```

---

## Building for Production

### Build Process

```bash
# Build frontend
npm run build
# Output: dist/
#   - index.html
#   - assets/index-[hash].js
#   - assets/index-[hash].css
```

### Testing Production Build

```bash
# Build and start production server
npm start

# Access at http://localhost:3000
```

### Deployment Checklist

- [ ] Environment variables configured
- [ ] Tests passing
- [ ] No console errors
- [ ] API keys valid
- [ ] Frontend built successfully
- [ ] Server starts without errors
- [ ] All features working
- [ ] Error handling tested

---

## IDE Setup

### VS Code (Recommended)

**Recommended Extensions**:

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- Error Lens
- Git Graph

**Settings** (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

**Launch Configuration** (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "runtimeArgs": ["-r", "ts-node/register"],
      "args": ["server.ts"],
      "cwd": "${workspaceFolder}",
      "internalConsoleOptions": "openOnSessionStart"
    }
  ]
}
```

---

## API Development

### Testing API Endpoints

**Using curl**:

```bash
# Upload image
curl -X POST http://localhost:3000/api/upload \
  -F "image=@/path/to/image.jpg"

# Process batch
curl -X POST http://localhost:3000/api/process-batch \
  -H "Content-Type: application/json" \
  -d '{"initials": "OY"}'

# Export CSV
curl -X POST http://localhost:3000/api/export-csv \
  -H "Content-Type: application/json" \
  -d '{"csvFileName": "OY_1762644147709.csv"}' \
  -o output.csv
```

**Using Postman**:

1. Create new collection: "Adobe Stock Uploader"
2. Add requests for each endpoint
3. Save for team sharing

---

## Troubleshooting

### Reset Everything

```bash
# 1. Clean dependencies
rm -rf node_modules package-lock.json
npm install

# 2. Clean build
rm -rf dist

# 3. Clean temporary files
rm -rf uploads/* images/* csv_output/*

# 4. Restart servers
npm run dev
```

### Check Logs

**Server Logs**:

- Console output from `npm run dev:server`
- Look for emoji indicators:
  - 🚀 Server started
  - ✅ Success
  - ❌ Error
  - ⚠️ Warning

**Frontend Logs**:

- Browser console (F12)
- Network tab for API calls
- React DevTools console

---

## Getting Help

### Documentation

- **README.md**: Getting started
- **IMPROVEMENT_PLAN.md**: Planned enhancements
- **docs/**: All technical documentation
- **Code comments**: Inline explanations

### External Resources

- [React Docs](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express Guide](https://expressjs.com/en/guide/routing.html)
- [Vite Documentation](https://vitejs.dev/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [OpenAI API Reference](https://platform.openai.com/docs/)
- [Cloudinary Docs](https://cloudinary.com/documentation)

---

## Next Steps

### For New Developers

1. ✅ Complete Quick Start setup
2. ✅ Run `npm run dev` and verify it works
3. ✅ Read `README.md` and `project-overview.md`
4. ✅ Explore codebase starting with `client/src/app.tsx` and `src/`
5. ✅ Run tests: `npm test`
6. ✅ Make a small change and commit

### For Contributors

1. ✅ Review `IMPROVEMENT_PLAN.md` for tasks
2. ✅ Pick an improvement to implement
3. ✅ Create feature branch
4. ✅ Implement with tests
5. ✅ Submit PR with good description

### Learning Resources

- Read `integration-architecture.md` to understand data flow
- Study `api-contracts-api.md` for API details
- Review `ui-component-inventory-client.md` for UI components
- Check `backend-utilities-api.md` for utility functions

---

**Happy Coding!** 🚀

For questions or issues, refer to the comprehensive documentation in `docs/` or check `IMPROVEMENT_PLAN.md` for known issues and planned fixes.

**Last Updated**: November 9, 2025
