import React from 'react';
import type { UploadedImage } from '../types';
import type { ValidationError } from '../utils/validation';
import { MAX_IMAGE_COUNT } from '../utils/validation';
import { formatFileSize } from '../utils/format';

interface UploadViewProps {
  images: UploadedImage[];
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  validationErrors: ValidationError[];
  onSelectImagesClick: () => void;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onImageDelete: (id: string) => void;
}

export function UploadView({
  images,
  isDragging,
  fileInputRef,
  validationErrors,
  onSelectImagesClick,
  onFileInputChange,
  onDragEnter,
  onDragLeave,
  onImageDelete,
}: UploadViewProps) {
  const atLimit = images.length >= MAX_IMAGE_COUNT;

  if (images.length === 0) {
    return (
      <div
        className="relative w-full max-w-3xl"
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={onFileInputChange}
          className="hidden"
        />
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
          {/* Animated backdrop */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/20 to-transparent opacity-50" />

          {/* Main Button */}
          <button
            onClick={onSelectImagesClick}
            className="lava-button grain-gradient relative z-10 px-16 py-5 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] text-primary-foreground rounded-full transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl active:scale-[0.98] cursor-pointer select-none group overflow-hidden"
          >
            <span className="relative z-10 tracking-[-0.02em] text-[1.125rem]">Select Images</span>
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 rounded-full pointer-events-none z-10" />
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 rounded-full transition-all duration-300 pointer-events-none z-10" />
          </button>

          <div className="relative z-10 flex flex-col items-center gap-2">
            <p className="opacity-30 tracking-[-0.01em] text-[0.9rem]">or drop your images here</p>
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

        {/* Validation errors in empty state */}
        {validationErrors.length > 0 && (
          <div className="mt-4 space-y-1">
            {validationErrors.map((err, i) => (
              <p key={i} className="text-[0.8rem] text-red-500/80 tracking-[-0.01em]">
                {err.fileName ? `${err.fileName}: ` : ''}
                {err.reason}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  const totalSize = images.reduce((sum, img) => sum + img.file.size, 0);

  return (
    <div className="w-full max-w-3xl px-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp"
        onChange={onFileInputChange}
        className="hidden"
        disabled={atLimit}
      />
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="tracking-[-0.01em] opacity-40 text-[0.875rem] uppercase">
            {images.length} of {MAX_IMAGE_COUNT} images added
          </span>
          <span className="tracking-[-0.01em] opacity-30 text-[0.8rem]">
            Total: {formatFileSize(totalSize)}
          </span>
        </div>
        {atLimit ? (
          <span className="text-[0.875rem] tracking-[-0.01em] opacity-30">Limit reached</span>
        ) : (
          <button
            onClick={onSelectImagesClick}
            className="text-[0.875rem] tracking-[-0.01em] opacity-60 hover:opacity-100 transition-opacity underline underline-offset-2"
          >
            Add more images
          </button>
        )}
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="mb-4 space-y-1">
          {validationErrors.map((err, i) => (
            <p key={i} className="text-[0.8rem] text-red-500/80 tracking-[-0.01em]">
              {err.fileName ? `${err.fileName}: ` : ''}
              {err.reason}
            </p>
          ))}
        </div>
      )}

      <div className="max-h-[400px] overflow-y-auto pr-3 -mr-3" style={{ scrollbarWidth: 'thin' }}>
        <div className="grid grid-cols-4 gap-4 pb-2">
          {images.map(image => (
            <div
              key={image.id}
              className="grain-gradient relative rounded-2xl overflow-hidden bg-gradient-to-br from-white/60 to-white/40 border-2 border-border/20 group hover:scale-[1.02] transition-all duration-300 animate-[fadeSlideIn_300ms_ease-out_both]"
            >
              <div className="aspect-square">
                <img
                  src={image.preview}
                  alt={image.file.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="px-2 py-1.5 space-y-0.5">
                <p className="text-[0.7rem] opacity-60 truncate">{image.file.name}</p>
                <p className="text-[0.65rem] opacity-40">{formatFileSize(image.file.size)}</p>
              </div>
              <button
                onClick={() => onImageDelete(image.id)}
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
    </div>
  );
}
