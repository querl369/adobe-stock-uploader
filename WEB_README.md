# Adobe Stock Image Uploader - Web Interface

A simple web application to process images for Adobe Stock upload. Upload images, generate metadata using AI (OpenAI), and export to CSV format.

## ✨ Features

- 📤 **Drag & Drop Upload** - Easy image uploading
- 🤖 **AI-Powered Metadata** - Automatic title, keywords, and category generation using OpenAI GPT-4 Vision
- 📊 **CSV Export** - Export metadata in Adobe Stock compatible format
- 🎨 **Clean UI** - Simple, modern interface (no complex frameworks!)
- 🔒 **Type-Safe** - Built with TypeScript for reliability

## 🛠️ Tech Stack

**Simple & Minimal:**

- **Backend:** Express.js (simple web server) + TypeScript
- **Frontend:** Plain HTML + CSS + TypeScript (no React, no Vite, no build complexity!)
- **Image Processing:** Sharp, Cloudinary
- **AI:** OpenAI GPT-4 Vision API

## 📋 Prerequisites

- Node.js (v16 or higher)
- Cloudinary account ([Sign up free](https://cloudinary.com/))
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

## 🚀 Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Create a `.env` file in the root directory:

```env
# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 3. Run the web app

```bash
npm run web
```

Then open your browser and go to: **http://localhost:3000**

## 📖 How to Use

1. **Upload Images**
   - Drag & drop images or click to browse
   - Supports JPG, PNG, JPEG, WEBP

2. **Enter Your Initials**
   - Images will be renamed with your initials (e.g., `OY_20250323_1.jpg`)

3. **Process Images**
   - Click "Generate Metadata with AI"
   - AI will analyze each image and generate:
     - Title
     - Keywords (comma-separated)
     - Category

4. **Review & Export**
   - Review the generated metadata
   - Click "Download CSV for Adobe Stock"
   - Upload the CSV to Adobe Stock Contributor portal

## 📁 Project Structure

```
adobe-stock-uploader/
├── server.ts              # Express web server (TypeScript)
├── public/                # Frontend files
│   ├── index.html        # Main UI (simple HTML)
│   ├── style.css         # Styling (vanilla CSS)
│   ├── app.ts            # UI logic (TypeScript)
│   └── app.js            # Compiled JavaScript
├── src/                   # Backend logic
│   ├── index.ts          # CLI version (original)
│   ├── cloudinary.ts     # Cloudinary integration
│   ├── openai.ts         # OpenAI API calls
│   ├── files-manipulation.ts
│   ├── csv-writer.ts
│   └── prompt-text.ts
├── images/                # Processed images
├── uploads/               # Temporary uploads
└── csv_output/            # Generated CSV files
```

## 🔧 Scripts

```bash
# Run the web interface
npm run web

# Run the original CLI version
npm start

# Development mode (with auto-reload)
npm run dev
```

## 🎯 How It Works

1. **Upload**: Images are uploaded to the `uploads/` folder
2. **Process**: Each image is:
   - Renamed with your initials
   - Uploaded temporarily to Cloudinary (for AI analysis)
   - Analyzed by OpenAI GPT-4 Vision to generate metadata
   - Deleted from Cloudinary (we don't store them there)
3. **Export**: Metadata is compiled into a CSV file compatible with Adobe Stock

## 🐛 Troubleshooting

### Error: "Missing API keys"

- Check your `.env` file has all required keys
- Restart the server after adding environment variables

### Error: "Image upload failed"

- Check Cloudinary credentials
- Ensure image file size is under 50MB

### Error: "OpenAI API error"

- Verify your OpenAI API key is valid
- Check you have credits available

## 💡 Tips

- **Best image quality**: Use high-resolution images (min 4MP)
- **Batch processing**: Upload multiple images at once
- **Review metadata**: Always review AI-generated metadata before exporting
- **Keep backups**: CSV files are saved in `csv_output/` folder

## 🔐 Security Note

- Never commit your `.env` file to git (it's in `.gitignore`)
- Keep your API keys secret
- This app runs locally on your computer

## 📝 License

ISC

## 🤝 Contributing

This is a personal project, but suggestions are welcome!

---

Made with ❤️ for Adobe Stock Contributors
