# Adobe Stock Uploader

An elegant, AI-powered web application for uploading images to Adobe Stock with automatic metadata generation.

## ✨ Features

- 🎨 **Modern UI**: Beautiful Figma-designed interface with glassmorphism effects
- 🤖 **AI-Powered Metadata**: Automatic title, keywords, and category generation using OpenAI GPT-5-mini
- 🖼️ **Batch Processing**: Upload and process multiple images simultaneously
- 📦 **CSV Export**: Generates Adobe Stock-compatible CSV files
- ☁️ **Cloud Integration**: Cloudinary for temporary image hosting
- 🔄 **Drag & Drop**: Intuitive file upload with visual feedback
- ⚡ **Real-time Progress**: Live progress tracking during processing

## 🚀 Getting Started

### Prerequisites

- Node.js (v20+ recommended)
- npm or yarn
- OpenAI API key
- Cloudinary account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd adobe-stock-uploader
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

### Development

Run both the client (Vite) and server (Express) concurrently:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### Production

Build and start the production server:

```bash
npm run build
npm start
```

The app will be available at http://localhost:3000

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - High-quality UI components
- **Radix UI** - Accessible component primitives
- **React DnD** - Drag and drop functionality

### Backend
- **Express** - Web server framework
- **TypeScript** - Type-safe server code
- **Multer** - File upload handling
- **Sharp** - Image processing
- **OpenAI SDK** - AI metadata generation
- **Cloudinary SDK** - Image hosting

### Development
- **Vitest** - Unit and integration testing
- **Husky** - Git hooks
- **lint-staged** - Pre-commit linting
- **Prettier** - Code formatting

## 📁 Project Structure

```
adobe-stock-uploader/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   │   └── ui/        # shadcn/ui components
│   │   ├── styles/        # CSS and styling
│   │   ├── app.tsx        # Main App component
│   │   └── main.tsx       # Entry point
│   └── index.html         # HTML template
├── src/                   # Backend utilities
│   ├── cloudinary.ts     # Cloudinary integration
│   ├── openai.ts         # OpenAI integration
│   ├── files-manipulation.ts  # Image processing
│   └── csv-writer.ts     # CSV generation
├── tests/                # Test files
├── server.ts             # Express server
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts
```

## 🔑 API Endpoints

### POST `/api/upload`
Upload a single image file.

**Request**: `multipart/form-data` with `image` field

**Response**:
```json
{
  "success": true,
  "file": {
    "id": "unique-id",
    "name": "original-name.jpg",
    "size": 123456,
    "path": "uploads/unique-id-original-name.jpg"
  }
}
```

### POST `/api/process-batch`
Process all uploaded images with AI metadata generation.

**Request**:
```json
{
  "initials": "OY"
}
```

**Response**:
```json
{
  "metadataList": [
    {
      "fileName": "IMG_OY_20251108_1.jpg",
      "title": "AI-generated title",
      "keywords": "keyword1, keyword2, keyword3",
      "category": 5
    }
  ],
  "csvFileName": "OY_1731024000000.csv"
}
```

### POST `/api/export-csv`
Download the generated CSV file.

**Request**:
```json
{
  "csvFileName": "OY_1731024000000.csv"
}
```

**Response**: CSV file download

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## 📝 Workflow

1. **Upload Images**: Drag and drop or select image files
2. **Enter Initials**: Provide your initials for file naming
3. **Process**: Click "Generate & Export CSV" to:
   - Rename images with your initials and date
   - Upload to Cloudinary
   - Generate metadata using OpenAI
   - Create Adobe Stock CSV
   - Download CSV automatically
4. **Done**: Upload the CSV and images to Adobe Stock

## 🎨 Design Features

- **Grain Effect**: Subtle texture overlay for depth
- **Lava Button**: Animated gradient button with hover effects
- **Glassmorphism**: Frosted glass aesthetic with backdrop blur
- **Responsive**: Works on desktop and tablet devices
- **Dark Mode Ready**: CSS variables for easy theme switching

## 🔒 Security

- API keys stored in environment variables
- Sandbox restrictions on file operations
- Input validation on all endpoints
- Automatic cleanup of temporary files

## 📜 Scripts

- `npm run dev` - Start development servers
- `npm run build` - Build for production
- `npm start` - Run production server
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests: `npm test`
4. Commit using format: `ASU-{description}`
5. Push and create a pull request

## 📄 License

ISC

## 🙏 Acknowledgments

- Design inspired by Figma minimalist templates
- UI components from shadcn/ui
- Icons from Lucide React

---

Built with ❤️ for Adobe Stock creators
