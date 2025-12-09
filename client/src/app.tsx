import React, { useState, useRef, useEffect } from 'react';
import { DndProvider, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Progress } from './components/ui/progress';

/**
 * Generate CSV file from metadata
 * Adobe Stock format: Filename, Title, Keywords, Category, Releases
 */
function generateCSV(
  images: Array<{
    filename: string;
    title?: string;
    keywords?: string;
    category?: number;
  }>,
  initials: string
): string {
  const headers = ['Filename', 'Title', 'Keywords', 'Category', 'Releases'];
  const rows = images
    .filter((img) => img.title && img.keywords && img.category)
    .map((img) => {
      return [
        img.filename,
        `"${img.title}"`, // Wrap in quotes for CSV safety
        `"${img.keywords}"`,
        img.category?.toString() || '',
        initials,
      ].join(',');
    });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Download CSV file
 */
function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  description?: string;
  title?: string;
  keywords?: string;
  category?: number;
  fileId?: string; // Server-side file ID from upload response
}

interface ProcessingState {
  isProcessing: boolean;
  currentIndex: number;
  currentFileName: string;
}

function DropZone({
  children,
  onFileDrop,
}: {
  children: React.ReactNode;
  onFileDrop: (files: File[]) => void;
}) {
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: ['__NATIVE_FILE__'],
      drop: (item: any, monitor) => {
        const files = monitor.getItem()?.files;
        if (files) {
          onFileDrop(Array.from(files));
        }
      },
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    }),
    [onFileDrop]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    );

    if (files.length > 0) {
      onFileDrop(files);
    }
  };

  return (
    <div
      ref={drop}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="min-h-screen flex flex-col items-center justify-center p-8 transition-all duration-300"
      style={{
        backgroundColor: isOver ? 'rgba(0, 0, 0, 0.02)' : 'transparent',
      }}
    >
      {children}
    </div>
  );
}

function App() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [initials, setInitials] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState<ProcessingState>({
    isProcessing: false,
    currentIndex: 0,
    currentFileName: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up server files on initial load
  useEffect(() => {
    const cleanup = async () => {
      try {
        await fetch('/api/cleanup', { method: 'POST' });
        console.log('✅ Initial cleanup complete');
      } catch (error) {
        console.error('Error during initial cleanup:', error);
      }
    };
    cleanup();
  }, []);

  const handleFileSelect = async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      return;
    }

    // Upload files to server using the modern batch upload endpoint
    const formData = new FormData();
    imageFiles.forEach((file) => {
      formData.append('images', file); // Note: 'images' (plural) for batch upload
    });

    try {
      const response = await fetch('/api/upload-images', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to upload images');
        return;
      }

      const result: {
        success: boolean;
        files: Array<{ id: string; name: string; size: number }>;
        sessionUsage: string;
      } = await response.json();

      console.log('✅ Upload successful:', result.sessionUsage);

      // Create image objects with server file IDs
      const newImages: UploadedImage[] = imageFiles.map((file, index) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: URL.createObjectURL(file),
        fileId: result.files[index]?.id, // Store server-side file ID
      }));

      setImages((prev) => [...prev, ...newImages]);
      setIsDragging(false);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Failed to upload images. Please try again.');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelect(Array.from(e.target.files));
    }
  };

  const handleSelectImagesClick = () => {
    fileInputRef.current?.click();
  };

  const handleGenerateMetadata = async () => {
    if (!initials) {
      alert('Please enter your initials');
      return;
    }

    // Collect file IDs from uploaded images
    const fileIds = images
      .map((img) => img.fileId)
      .filter((id): id is string => id !== undefined);

    if (fileIds.length === 0) {
      alert('No files to process. Please upload images first.');
      return;
    }

    setProcessing({
      isProcessing: true,
      currentIndex: 0,
      currentFileName: images[0]?.file.name || '',
    });

    try {
      // Start batch processing using the modern endpoint
      const response = await fetch('/api/process-batch-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileIds }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process images');
      }

      const result: {
        success: boolean;
        batchId: string;
        message: string;
      } = await response.json();

      console.log('✅ Batch processing started:', result.batchId);

      // Poll for batch status
      const batchId = result.batchId;
      let isComplete = false;

      while (!isComplete) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Poll every 2 seconds

        const statusResponse = await fetch(`/api/batch-status/${batchId}`);
        if (!statusResponse.ok) {
          throw new Error('Failed to get batch status');
        }

        const statusData: {
          batchId: string;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          progress: {
            total: number;
            completed: number;
            failed: number;
            processing: number;
            pending: number;
          };
          images: Array<{
            id: string;
            filename: string;
            status: 'pending' | 'processing' | 'success' | 'failed';
            metadata?: {
              title: string;
              keywords: string;
              category: number;
            };
            error?: string;
          }>;
          estimatedTimeRemaining?: number;
        } = await statusResponse.json();

        // Update progress
        setProcessing({
          isProcessing: true,
          currentIndex: statusData.progress.completed,
          currentFileName: statusData.images.find((img) => img.status === 'processing')
            ?.filename || '',
        });

        console.log(
          `Progress: ${statusData.progress.completed}/${statusData.progress.total}`
        );

        if (statusData.status === 'completed' || statusData.status === 'failed') {
          isComplete = true;

          // Update images with metadata from successful results
          const updatedImages = images.map((img) => {
            const result = statusData.images.find(
              (imgResult) => imgResult.id === img.fileId
            );
            if (result && result.status === 'success' && result.metadata) {
              return {
                ...img,
                title: result.metadata.title,
                keywords: result.metadata.keywords,
                category: result.metadata.category,
                description: result.metadata.title,
              };
            }
            return img;
          });

          setImages(updatedImages);

          // Generate and download CSV with the metadata
          const csvData = statusData.images
            .filter((img) => img.status === 'success' && img.metadata)
            .map((img) => ({
              filename: img.filename,
              title: img.metadata!.title,
              keywords: img.metadata!.keywords,
              category: img.metadata!.category,
            }));

          if (csvData.length > 0) {
            const csvContent = generateCSV(csvData, initials);
            const csvFilename = `${initials}_${Date.now()}.csv`;
            downloadCSV(csvContent, csvFilename);
            console.log('✅ CSV downloaded:', csvFilename);
          }

          // Show completion message
          const successCount = statusData.progress.completed - statusData.progress.failed;
          if (successCount > 0) {
            alert(
              `Processing complete! ${successCount} of ${statusData.progress.total} images processed successfully. CSV file downloaded.`
            );
          } else {
            alert('Processing failed. No images were processed successfully.');
          }
        }
      }
    } catch (error) {
      console.error('Error generating metadata:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Error generating metadata. Please try again.'
      );
    } finally {
      setProcessing({
        isProcessing: false,
        currentIndex: 0,
        currentFileName: '',
      });
    }
  };

  const handleClear = async () => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    setInitials('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Clean up server-side uploaded files
    try {
      await fetch('/api/cleanup', {
        method: 'POST',
      });
      console.log('✅ Server files cleaned up');
    } catch (error) {
      console.error('Error cleaning up server files:', error);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="grain min-h-screen bg-gradient-to-br from-[#fafafa] via-[#f5f5f5] to-[#efefef]">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 px-8 py-5 backdrop-blur-sm bg-gradient-to-b from-background/80 to-transparent">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-foreground" />
              <span className="tracking-[-0.02em] opacity-50 text-[13px]">
                Adobe Stock Uploader
              </span>
            </div>
            <div className="flex gap-2">
              <button className="px-5 py-2 rounded-full hover:bg-black/5 transition-all duration-200 tracking-[-0.01em] text-[13px]">
                About
              </button>
              <button className="px-5 py-2 rounded-full hover:bg-black/5 transition-all duration-200 tracking-[-0.01em] text-[13px]">
                Help
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <DropZone onFileDrop={handleFileSelect}>
          <div className="flex flex-col items-center gap-8 max-w-5xl w-full pt-20">
            {/* Hero Section */}
            <div className="text-center space-y-2 max-w-3xl px-4">
              <h1 className="tracking-[-0.04em] opacity-95 text-[clamp(2.5rem,5vw,4rem)] leading-[1.1]">
                Generate Metadata
                <br />
                For Your Images
              </h1>
              <p className="opacity-40 tracking-[-0.01em] text-[clamp(1rem,2vw,1.25rem)] max-w-xl mx-auto">
                AI-powered descriptions, exported instantly
              </p>
            </div>

            {/* Drag & Drop Zone OR Image Preview Grid */}
            {images.length === 0 ? (
              <div
                className="relative w-full max-w-3xl"
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
              >
                <div
                  className={`
                    grain-gradient
                    relative overflow-hidden
                    border-2 border-dashed rounded-[2rem] p-12
                    flex flex-col items-center gap-6
                    transition-all duration-500 ease-out
                    ${
                      isDragging
                        ? 'border-foreground/40 bg-gradient-to-br from-black/5 via-black/3 to-transparent scale-[1.02] shadow-2xl'
                        : 'border-border/20 bg-gradient-to-br from-white/60 via-white/40 to-transparent shadow-xl hover:border-border/30'
                    }
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />

                  {/* Animated backdrop */}
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/20 to-transparent opacity-50" />

                  {/* Main Button */}
                  <button
                    onClick={handleSelectImagesClick}
                    className="lava-button grain-gradient relative z-10 px-16 py-5 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] text-primary-foreground rounded-full transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl active:scale-[0.98] cursor-pointer select-none group overflow-hidden"
                  >
                    <span className="relative z-10 tracking-[-0.02em] text-[1.125rem]">
                      Select Images
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 rounded-full pointer-events-none z-10" />
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 rounded-full transition-all duration-300 pointer-events-none z-10" />
                  </button>

                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <p className="opacity-30 tracking-[-0.01em] text-[0.9rem]">
                      or drop your images here
                    </p>
                    <div className="flex gap-2 opacity-20">
                      <div className="w-1 h-1 rounded-full bg-foreground" />
                      <div className="w-1 h-1 rounded-full bg-foreground" />
                      <div className="w-1 h-1 rounded-full bg-foreground" />
                    </div>
                  </div>
                </div>

                {/* Glow effect when dragging */}
                {isDragging && (
                  <div className="absolute inset-0 rounded-[2rem] bg-foreground/5 blur-2xl -z-10 animate-pulse" />
                )}
              </div>
            ) : (
              <div className="w-full max-w-3xl px-4">
                <div className="mb-6 flex items-center justify-between">
                  <span className="tracking-[-0.01em] opacity-40 text-[0.875rem] uppercase">
                    {images.length} {images.length === 1 ? 'image' : 'images'}
                  </span>
                  <button
                    onClick={handleSelectImagesClick}
                    className="text-[0.875rem] tracking-[-0.01em] opacity-60 hover:opacity-100 transition-opacity underline underline-offset-2"
                  >
                    Add more images
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className="grain-gradient relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-white/60 to-white/40 border-2 border-border/20 group hover:scale-[1.02] transition-all duration-300"
                    >
                      <img
                        src={image.preview}
                        alt={image.file.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => {
                          URL.revokeObjectURL(image.preview);
                          setImages(images.filter((img) => img.id !== image.id));
                        }}
                        className="absolute top-3 right-3 w-7 h-7 bg-black/80 backdrop-blur-sm text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center hover:bg-black hover:scale-110"
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M1 1L9 9M1 9L9 1"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Input Fields and Action Buttons */}
            <div className="w-full max-w-3xl space-y-4 px-4">
              {/* Progress Bar */}
              {processing.isProcessing && (
                <div className="grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-2 border-border/20 rounded-2xl p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="tracking-[-0.01em] opacity-70 text-[0.875rem]">
                      Processing...
                    </span>
                    <span className="tracking-[-0.01em] opacity-50 text-[0.75rem] tabular-nums">
                      {processing.currentIndex + 1} / {images.length}
                    </span>
                  </div>
                  <Progress
                    value={((processing.currentIndex + 1) / images.length) * 100}
                    className="h-2"
                  />
                  <p className="tracking-[-0.01em] opacity-40 text-[0.75rem] truncate">
                    {processing.currentFileName}
                  </p>
                </div>
              )}

              {/* Initials Input */}
              <div className="space-y-2">
                <Label
                  htmlFor="initials"
                  className="tracking-[-0.01em] opacity-50 text-[0.75rem] uppercase"
                >
                  Your Initials
                </Label>
                <Input
                  id="initials"
                  type="text"
                  value={initials}
                  onChange={(e) => setInitials(e.target.value)}
                  placeholder="e.g., OY"
                  className="grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-border/20 rounded-2xl px-6 py-4 tracking-[-0.01em] text-[1rem] placeholder:opacity-30 focus:border-foreground/20 transition-all"
                  maxLength={5}
                  disabled={processing.isProcessing}
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleGenerateMetadata}
                  disabled={images.length === 0 || processing.isProcessing}
                  className="grain-gradient px-6 py-4 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] text-primary-foreground rounded-2xl transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl active:scale-[0.99] disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100 tracking-[-0.01em] text-[0.95rem] relative overflow-hidden group"
                >
                  <span className="relative z-10">
                    {processing.isProcessing ? 'Processing...' : 'Generate & Export CSV'}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 rounded-2xl pointer-events-none" />
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 rounded-2xl transition-all duration-300 pointer-events-none" />
                </button>
                <button
                  onClick={handleClear}
                  disabled={processing.isProcessing}
                  className="grain-gradient px-6 py-4 border-2 border-border/20 rounded-2xl transition-all duration-300 hover:bg-black/5 hover:border-border/30 active:scale-[0.99] disabled:opacity-20 disabled:cursor-not-allowed tracking-[-0.01em] text-[0.95rem] bg-white/40"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </DropZone>

        {/* Footer */}
        <footer className="fixed bottom-0 left-0 right-0 z-50 px-8 py-6 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span className="tracking-[-0.01em] opacity-25 text-[11px]">© 2025</span>
            <div className="flex gap-6">
              <button className="tracking-[-0.01em] opacity-30 hover:opacity-60 transition-opacity text-[11px]">
                GitHub
              </button>
              <button className="tracking-[-0.01em] opacity-30 hover:opacity-60 transition-opacity text-[11px]">
                Twitter
              </button>
            </div>
          </div>
        </footer>
      </div>
    </DndProvider>
  );
}

export default App;

