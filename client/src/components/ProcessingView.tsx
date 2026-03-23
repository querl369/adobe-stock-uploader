import { useState, useEffect, useMemo } from 'react';
import { Check, Loader2, XCircle, Circle } from 'lucide-react';
import { Progress } from './ui/progress';
import type { UploadedImage, BatchStatusResponse } from '../types';

interface ProcessingViewProps {
  images: UploadedImage[];
  batchStatus: BatchStatusResponse | null;
  onComplete: () => void;
  onBackToUpload: () => void;
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '';
  if (seconds < 60) return `About ${Math.round(seconds)} seconds remaining`;
  const minutes = Math.round(seconds / 60);
  return `About ${minutes} minute${minutes > 1 ? 's' : ''} remaining`;
}

export function ProcessingView({
  images,
  batchStatus,
  onComplete,
  onBackToUpload,
}: ProcessingViewProps) {
  const [startTime] = useState(() => Date.now());
  const statusMap = useMemo(
    () => (batchStatus ? new Map(batchStatus.images.map(bi => [bi.id, bi])) : new Map()),
    [batchStatus]
  );

  // Auto-transition on completion
  useEffect(() => {
    if (!batchStatus) return;
    if (batchStatus.status !== 'completed' && batchStatus.status !== 'failed') return;

    const allFailed = batchStatus.progress.failed === batchStatus.progress.total;
    if (allFailed) return;

    const timer = setTimeout(() => onComplete(), 1500);
    return () => clearTimeout(timer);
  }, [batchStatus?.status, onComplete]);

  // Loading state before first poll
  if (!batchStatus) {
    return (
      <div className="w-full max-w-3xl px-4">
        <div className="grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-2 border-border/20 rounded-2xl p-6 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin opacity-50" />
          <span className="tracking-[-0.01em] opacity-50 text-[0.875rem]">
            Starting processing...
          </span>
        </div>
      </div>
    );
  }

  const { progress, status } = batchStatus;
  const progressPercent =
    progress.total > 0 ? Math.min(100, (progress.completed / progress.total) * 100) : 0;
  const successCount = progress.completed - progress.failed;
  const isFinished = status === 'completed' || status === 'failed';
  const allFailed = isFinished && progress.failed === progress.total;

  // Processing speed calculation
  const elapsed = (Date.now() - startTime) / 1000;
  const avgSpeed = progress.completed > 0 ? elapsed / progress.completed : 0;

  return (
    <div className="w-full max-w-3xl px-4 space-y-4">
      {/* Progress info section */}
      <div className="grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-2 border-border/20 rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="tracking-[-0.01em] opacity-70 text-[0.875rem]">
            {!isFinished
              ? 'Processing...'
              : allFailed
                ? 'Processing failed'
                : progress.failed > 0
                  ? 'Processing finished'
                  : 'Processing complete!'}
          </span>
          <span className="tracking-[-0.01em] opacity-50 text-[0.75rem] tabular-nums">
            {progress.completed} of {progress.total} images processed
          </span>
        </div>
        <div className="transition-all duration-500">
          <Progress value={progressPercent} className="h-2" />
        </div>
        {!isFinished && (
          <div className="flex items-center gap-3 text-[0.75rem] tracking-[-0.01em] opacity-40">
            {avgSpeed > 0 && (
              <span className="tabular-nums">~{avgSpeed.toFixed(1)}s per image</span>
            )}
            {avgSpeed > 0 && batchStatus.estimatedTimeRemaining != null && (
              <span className="opacity-60">·</span>
            )}
            {batchStatus.estimatedTimeRemaining != null &&
              batchStatus.estimatedTimeRemaining > 0 && (
                <span>{formatTimeRemaining(batchStatus.estimatedTimeRemaining)}</span>
              )}
          </div>
        )}

        {/* Completion summary */}
        {isFinished && !allFailed && (
          <p className="text-[0.8rem] tracking-[-0.01em] opacity-60">
            {progress.failed > 0
              ? `${successCount} of ${progress.total} processed, ${progress.failed} failed`
              : 'Processing complete!'}
          </p>
        )}
        {allFailed && (
          <div className="space-y-3">
            <p className="text-[0.8rem] tracking-[-0.01em] text-red-500/80">
              All images failed to process.
            </p>
            <button
              onClick={onBackToUpload}
              className="grain-gradient px-6 py-3 border-2 border-border/20 rounded-2xl transition-all duration-300 hover:bg-black/5 hover:border-border/30 active:scale-[0.99] tracking-[-0.01em] text-[0.875rem] bg-white/40"
            >
              Back to Upload
            </button>
          </div>
        )}
      </div>

      {/* Thumbnail grid */}
      <div className="max-h-[400px] overflow-y-auto pr-3 -mr-3 thin-scrollbar">
        <div className="grid grid-cols-4 gap-4 pb-2">
          {images.map(image => {
            const imgStatus = statusMap.get(image.fileId);
            return (
              <div
                key={image.id}
                className="grain-gradient relative rounded-2xl overflow-hidden bg-gradient-to-br from-white/60 to-white/40 border-2 border-border/20"
              >
                <div className="aspect-square relative">
                  <img
                    src={image.preview}
                    alt={image.file.name}
                    className="w-full h-full object-cover"
                  />
                  {/* Status overlay */}
                  {imgStatus?.status === 'completed' && (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-300"
                      aria-label="Completed"
                    >
                      <Check className="w-5 h-5 text-green-500" />
                      <span className="text-[0.65rem] text-white/90 mt-1">Done</span>
                    </div>
                  )}
                  {imgStatus?.status === 'processing' && (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-300"
                      aria-label="Processing"
                    >
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                      <span className="text-[0.65rem] text-white/90 mt-1">Processing...</span>
                    </div>
                  )}
                  {imgStatus?.status === 'failed' && (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-300"
                      aria-label={`Failed${imgStatus.error ? `: ${imgStatus.error}` : ''}`}
                    >
                      <XCircle className="w-5 h-5 text-red-500" />
                      <span className="text-[0.65rem] text-white/90 mt-1">Failed</span>
                    </div>
                  )}
                  {(!imgStatus || imgStatus.status === 'pending') && (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 transition-opacity duration-300"
                      aria-label="Waiting"
                    >
                      <Circle className="w-5 h-5 text-white/40" />
                      <span className="text-[0.65rem] text-white/50 mt-1">Waiting</span>
                    </div>
                  )}
                </div>
                <div className="px-2 py-1.5">
                  <p className="text-[0.7rem] opacity-60 truncate">{image.file.name}</p>
                  {imgStatus?.status === 'failed' && imgStatus.error && (
                    <p className="text-[0.6rem] text-red-500/70 truncate" title={imgStatus.error}>
                      {imgStatus.error}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
