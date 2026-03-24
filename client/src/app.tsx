import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DndProvider, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { AppHeader } from './components/AppHeader';
import { AppFooter } from './components/AppFooter';
import { UploadView } from './components/UploadView';
import { ProcessingView } from './components/ProcessingView';
import { ResultsView } from './components/ResultsView';
import { uploadImages, startBatchProcessing, getBatchStatus, cleanup } from './api/client';
import { generateCSV, downloadCSV } from './utils/csv';
import { validateFiles } from './utils/validation';
import type { ValidationError } from './utils/validation';
import type { UploadedImage, AppView, BatchStatusResponse } from './types';

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
      drop: (_item: unknown, monitor) => {
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
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFileDrop(files);
    }
  };

  return (
    <div
      ref={drop}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="min-h-screen flex flex-col items-center p-8 transition-all duration-300"
      style={{ backgroundColor: isOver ? 'rgba(0, 0, 0, 0.02)' : 'transparent' }}
    >
      {children}
    </div>
  );
}

function App() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [initials, setInitials] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [view, setView] = useState<AppView>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchStatus, setBatchStatus] = useState<BatchStatusResponse | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [processingDuration, setProcessingDuration] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const validationTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    cleanup().catch(error => console.error('Error during initial cleanup:', error));
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.preview));
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
    };
  }, []);

  const handleFileSelect = async (files: File[]) => {
    // Clear previous validation errors
    if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
    setValidationErrors([]);

    const { valid, errors } = validateFiles(files, images.length);

    if (errors.length > 0) {
      setValidationErrors(errors);
      validationTimerRef.current = setTimeout(() => setValidationErrors([]), 5000);
    }

    if (valid.length === 0) return;

    try {
      const result = await uploadImages(valid);
      console.log('Upload successful:', result.sessionUsage);

      const newImages: UploadedImage[] = valid.map((file, index) => ({
        id: Math.random().toString(36).substring(2, 11),
        file,
        preview: URL.createObjectURL(file),
        fileId: result.files[index]?.id,
      }));

      setImages(prev => [...prev, ...newImages]);
      setIsDragging(false);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload images. Please try again.');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFileSelect(Array.from(e.target.files));
    e.target.value = '';
  };

  const handleSelectImagesClick = () => fileInputRef.current?.click();

  const handleGenerateMetadata = async () => {
    if (!initials) { alert('Please enter your initials'); return; }
    const fileIds = images.map(img => img.fileId).filter((id): id is string => id !== undefined);
    if (fileIds.length === 0) { alert('No files to process. Please upload images first.'); return; }

    const startTime = Date.now();
    setView('processing');
    setBatchStatus(null);
    setProcessingDuration(null);
    setIsProcessing(true);

    let lastStatusData: BatchStatusResponse | null = null;

    try {
      const { batchId } = await startBatchProcessing(fileIds);
      let isComplete = false;

      while (!isComplete) {
        const statusData = await getBatchStatus(batchId);

        lastStatusData = statusData;
        setBatchStatus(statusData);

        if (statusData.status === 'completed' || statusData.status === 'failed') {
          isComplete = true;

          setImages(prev =>
            prev.map(img => {
              const r = statusData.images.find(i => i.id === img.fileId);
              if (r?.status === 'completed' && r.metadata) {
                return { ...img, title: r.metadata.title, keywords: r.metadata.keywords, category: r.metadata.category, description: r.metadata.title };
              }
              return img;
            })
          );

          const csvData = statusData.images
            .filter(img => img.status === 'completed' && img.metadata)
            .map(img => ({ filename: img.filename, title: img.metadata!.title, keywords: img.metadata!.keywords, category: img.metadata!.category }));

          if (csvData.length > 0) {
            downloadCSV(generateCSV(csvData, initials), `${initials}_${Date.now()}.csv`);
          }

          setProcessingDuration(Math.round((Date.now() - startTime) / 1000));
        }

        if (!isComplete) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error('Error generating metadata:', error);

      // Download CSV for any partially successful images before navigating away
      if (lastStatusData) {
        const csvData = lastStatusData.images
          .filter(img => img.status === 'completed' && img.metadata)
          .map(img => ({ filename: img.filename, title: img.metadata!.title, keywords: img.metadata!.keywords, category: img.metadata!.category }));
        if (csvData.length > 0) {
          downloadCSV(generateCSV(csvData, initials), `${initials}_${Date.now()}.csv`);
        }
      }

      alert(error instanceof Error ? error.message : 'Error generating metadata. Please try again.');
      setBatchStatus(null);
      setView('upload');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = useCallback(() => {
    setImages(prev => {
      prev.forEach(img => URL.revokeObjectURL(img.preview));
      return [];
    });
    setInitials('');
    setBatchStatus(null);
    setProcessingDuration(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    cleanup().catch(error => console.error('Error cleaning up server files:', error));
  }, []);

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget === e.target) setIsDragging(false);
  };

  const handleImageDelete = (id: string) => {
    const image = images.find(img => img.id === id);
    if (image) URL.revokeObjectURL(image.preview);
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const handleProcessingComplete = useCallback(() => {
    setView('results');
  }, []);

  const handleBackToUpload = useCallback(() => {
    handleClear();
    setView('upload');
  }, [handleClear]);

  const handleDownloadCsv = useCallback(() => {
    const csvData = images
      .filter(img => img.title && img.keywords && img.category)
      .map(img => ({
        filename: img.file.name,
        title: img.title!,
        keywords: img.keywords!,
        category: img.category!,
      }));
    if (csvData.length > 0) {
      downloadCSV(generateCSV(csvData, initials), `${initials}_${Date.now()}.csv`);
    }
  }, [images, initials]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="grain min-h-screen bg-gradient-to-br from-[#fafafa] via-[#f5f5f5] to-[#efefef]">
        <AppHeader />
        <DropZone onFileDrop={handleFileSelect}>
          <div className="flex flex-col items-center gap-8 max-w-5xl w-full pt-20 pb-32">
            {/* Hero Section */}
            <div className="text-center space-y-2 max-w-3xl px-4">
              <h1 className="tracking-[-0.04em] opacity-95 text-[clamp(2.5rem,5vw,4rem)] leading-[1.1]">
                Generate Metadata
                <br />
                For <span style={{ fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, color: '#E8112D' }}>Adobe Stock</span> Images
              </h1>
              <p className="opacity-40 tracking-[-0.01em] text-[clamp(1rem,2vw,1.25rem)] max-w-xl mx-auto">
                AI-powered descriptions, exported instantly
              </p>
            </div>

            {view === 'results' ? (
              <ResultsView
                images={images}
                batchStatus={batchStatus}
                initials={initials}
                processingDuration={processingDuration}
                onInitialsChange={setInitials}
                onDownloadCsv={handleDownloadCsv}
                onProcessMore={handleBackToUpload}
              />
            ) : view === 'processing' ? (
              <ProcessingView
                images={images}
                batchStatus={batchStatus}
                onComplete={handleProcessingComplete}
                onBackToUpload={handleBackToUpload}
              />
            ) : (
              <>
                <UploadView
                  images={images}
                  isDragging={isDragging}
                  fileInputRef={fileInputRef}
                  validationErrors={validationErrors}
                  onSelectImagesClick={handleSelectImagesClick}
                  onFileInputChange={handleFileInputChange}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onImageDelete={handleImageDelete}
                />

                <div className="w-full max-w-3xl space-y-4 px-4">
                  <div className="space-y-2">
                    <Label htmlFor="initials" className="tracking-[-0.01em] opacity-50 text-[0.75rem] uppercase">
                      Your Initials
                    </Label>
                    <Input
                      id="initials"
                      type="text"
                      value={initials}
                      onChange={e => setInitials(e.target.value)}
                      placeholder="e.g., OY"
                      className="grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-border/20 rounded-2xl px-6 py-4 tracking-[-0.01em] text-[1rem] placeholder:opacity-30 focus:border-foreground/20 transition-all"
                      maxLength={5}
                      disabled={isProcessing}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleGenerateMetadata}
                      disabled={images.length === 0 || isProcessing}
                      className="grain-gradient px-6 py-4 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] text-primary-foreground rounded-2xl transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl active:scale-[0.99] disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100 tracking-[-0.01em] text-[0.95rem] relative overflow-hidden group"
                    >
                      <span className="relative z-10">
                        {isProcessing ? 'Processing...' : 'Generate & Export CSV'}
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 rounded-2xl pointer-events-none" />
                      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 rounded-2xl transition-all duration-300 pointer-events-none" />
                    </button>
                    <button
                      onClick={handleClear}
                      disabled={isProcessing}
                      className="grain-gradient px-6 py-4 border-2 border-border/20 rounded-2xl transition-all duration-300 hover:bg-black/5 hover:border-border/30 active:scale-[0.99] disabled:opacity-20 disabled:cursor-not-allowed tracking-[-0.01em] text-[0.95rem] bg-white/40"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DropZone>
        <AppFooter />
      </div>
    </DndProvider>
  );
}

export default App;
