import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { Download, Clock, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/table';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { getBatches, downloadBatchCsv } from '../api/client';
import type { UploadedImage, BatchStatusResponse, BatchHistoryItem } from '../types';

interface ResultsViewProps {
  images: UploadedImage[];
  batchStatus: BatchStatusResponse | null;
  initials: string;
  processingDuration: number | null;
  onInitialsChange: (value: string) => void;
  onDownloadCsv: () => void;
  onProcessMore: () => void;
}

function formatBatchDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ResultsView({
  images,
  batchStatus,
  initials,
  processingDuration,
  onInitialsChange,
  onDownloadCsv,
  onProcessMore,
}: ResultsViewProps) {
  const [downloadFeedback, setDownloadFeedback] = useState(false);
  const [batches, setBatches] = useState<BatchHistoryItem[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [redownloadErrors, setRedownloadErrors] = useState<Record<string, string>>({});
  const [redownloadingId, setRedownloadingId] = useState<string | null>(null);
  const [redownloadSuccess, setRedownloadSuccess] = useState<Record<string, boolean>>({});
  const downloadTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const redownloadTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Fetch batch history on mount
  useEffect(() => {
    const controller = new AbortController();
    getBatches({ signal: controller.signal })
      .then(data => {
        if (!controller.signal.aborted) setBatches(data.batches);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        // Hide section on error
      })
      .finally(() => {
        if (!controller.signal.aborted) setBatchesLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, []);

  // Cleanup timers on unmount (H1 fix)
  useEffect(() => {
    return () => {
      if (downloadTimerRef.current) clearTimeout(downloadTimerRef.current);
      Object.values(redownloadTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  const handleDownload = useCallback(() => {
    try {
      onDownloadCsv();
      toast.success('CSV downloaded!');
      setDownloadFeedback(true);
      if (downloadTimerRef.current) clearTimeout(downloadTimerRef.current);
      downloadTimerRef.current = setTimeout(() => setDownloadFeedback(false), 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download CSV');
    }
  }, [onDownloadCsv]);

  const handleBatchRedownload = useCallback(async (batchId: string) => {
    setRedownloadingId(batchId);
    try {
      await downloadBatchCsv(batchId);
      toast.success('CSV downloaded!');
      setRedownloadSuccess(prev => ({ ...prev, [batchId]: true }));
      if (redownloadTimersRef.current[batchId]) {
        clearTimeout(redownloadTimersRef.current[batchId]);
      }
      redownloadTimersRef.current[batchId] = setTimeout(() => {
        setRedownloadSuccess(prev => {
          const next = { ...prev };
          delete next[batchId];
          return next;
        });
        delete redownloadTimersRef.current[batchId];
      }, 2000);
    } catch (error) {
      console.error('Failed to re-download batch CSV:', error);
      const message = error instanceof Error ? error.message : 'Download failed';
      toast.error(message);
      setRedownloadErrors(prev => ({ ...prev, [batchId]: message }));
      if (redownloadTimersRef.current[batchId]) {
        clearTimeout(redownloadTimersRef.current[batchId]);
      }
      redownloadTimersRef.current[batchId] = setTimeout(() => {
        setRedownloadErrors(prev => {
          const next = { ...prev };
          delete next[batchId];
          return next;
        });
        delete redownloadTimersRef.current[batchId];
      }, 3000);
    } finally {
      setRedownloadingId(null);
    }
  }, []);

  // Derive counts from batchStatus
  const total = batchStatus?.progress.total ?? images.length;
  // progress.completed includes BOTH successful and failed (backend: "Both count as done")
  const successCount = batchStatus
    ? Math.max(0, batchStatus.progress.completed - batchStatus.progress.failed)
    : images.filter(img => img.title && img.keywords && img.category).length;
  const failedCount = batchStatus?.progress.failed ?? 0;

  // Separate successful and failed images (memoized to match ProcessingView pattern)
  const successImages = useMemo(
    () => images.filter(img => img.title && img.keywords && img.category),
    [images]
  );
  const failedBatchImages = useMemo(
    () => batchStatus?.images.filter(bi => bi.status === 'failed') ?? [],
    [batchStatus]
  );

  return (
    <div className="w-full max-w-3xl px-4 space-y-6">
      {/* Summary Banner (AC1) */}
      <div className="grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-2 border-border/20 rounded-2xl p-6 space-y-2">
        <div className="flex items-center gap-2">
          {failedCount > 0 ? (
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          )}
          <span className="text-[1.1rem] tracking-[-0.02em] opacity-90">
            <span className="tabular-nums">{successCount}</span> of{' '}
            <span className="tabular-nums">{total}</span> images processed successfully
            {failedCount > 0 && (
              <span className="text-red-500/80">
                {' '}
                (<span className="tabular-nums">{failedCount}</span> failed)
              </span>
            )}
          </span>
        </div>
        {processingDuration != null && (
          <div className="flex items-center gap-1.5 opacity-50 text-[0.8rem] tracking-[-0.01em]">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {processingDuration === 0 ? (
                'Completed in less than a second'
              ) : (
                <>
                  Completed in <span className="tabular-nums">{processingDuration}</span> seconds
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Metadata Preview Table (AC2) */}
      {(successImages.length > 0 || failedBatchImages.length > 0) && (
        <div className="max-h-[400px] overflow-y-auto rounded-2xl border-2 border-border/20">
          <Table>
            <TableHeader className="sticky top-0 bg-white/95 backdrop-blur-sm z-10">
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="max-w-32">Filename</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="max-w-48">Keywords</TableHead>
                <TableHead className="w-16">Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {successImages.map(image => (
                <TableRow key={image.id}>
                  <TableCell className="p-2">
                    <img
                      src={image.preview}
                      alt={image.file.name}
                      className="w-10 h-10 rounded object-cover"
                    />
                  </TableCell>
                  <TableCell className="max-w-32 truncate text-[0.8rem]" title={image.file.name}>
                    {image.file.name}
                  </TableCell>
                  <TableCell className="text-[0.8rem]">{image.title}</TableCell>
                  <TableCell className="max-w-48 truncate text-[0.8rem]" title={image.keywords}>
                    {image.keywords}
                  </TableCell>
                  <TableCell className="w-16 text-[0.8rem] tabular-nums">
                    {image.category}
                  </TableCell>
                </TableRow>
              ))}
              {failedBatchImages.map(batchImg => {
                const failedImage = images.find(img => img.fileId === batchImg.id);
                return (
                  <TableRow key={batchImg.id} className="bg-red-50/50">
                    <TableCell className="p-2">
                      {failedImage ? (
                        <img
                          src={failedImage.preview}
                          alt={batchImg.filename}
                          className="w-10 h-10 rounded object-cover opacity-50"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-red-100/50" />
                      )}
                    </TableCell>
                    <TableCell
                      className="max-w-32 truncate text-[0.8rem]"
                      title={batchImg.filename}
                    >
                      {batchImg.filename}
                    </TableCell>
                    <TableCell colSpan={3} className="text-[0.8rem] text-red-500/80">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {batchImg.error || 'Processing failed'}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Download Experience (AC3) + Post-Download Actions (AC4) */}
      <div className="space-y-3">
        <div className="flex items-end gap-3">
          <div className="space-y-1.5 flex-shrink-0">
            <Label
              htmlFor="results-initials"
              className="tracking-[-0.01em] opacity-50 text-[0.75rem] uppercase"
            >
              Initials
            </Label>
            <Input
              id="results-initials"
              type="text"
              value={initials}
              onChange={e => onInitialsChange(e.target.value)}
              placeholder="e.g., OY"
              className="grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-border/20 rounded-2xl px-4 py-2 tracking-[-0.01em] text-[0.9rem] placeholder:opacity-30 focus:border-foreground/20 transition-all w-24"
              maxLength={5}
            />
          </div>
          <button
            onClick={handleDownload}
            disabled={successImages.length === 0 || !initials.trim() || downloadFeedback}
            className="grain-gradient flex-1 px-6 py-3 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] text-primary-foreground rounded-2xl transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl active:scale-[0.99] disabled:opacity-20 disabled:cursor-not-allowed tracking-[-0.01em] text-[0.95rem] relative overflow-hidden group flex items-center justify-center gap-2"
            aria-label={downloadFeedback ? 'Downloaded' : 'Download CSV'}
          >
            <span className="relative z-10 flex items-center gap-2">
              {downloadFeedback ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Downloaded!
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download CSV
                </>
              )}
            </span>
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 rounded-2xl pointer-events-none" />
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 rounded-2xl transition-all duration-300 pointer-events-none" />
          </button>
        </div>

        <button
          onClick={onProcessMore}
          className="grain-gradient w-full px-6 py-3 border-2 border-border/20 rounded-2xl transition-all duration-300 hover:bg-black/5 hover:border-border/30 active:scale-[0.99] tracking-[-0.01em] text-[0.95rem] bg-white/40 flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4 opacity-50" />
          Process More Images
        </button>
      </div>

      {/* Batch History Section (AC5) */}
      {batchesLoading && (
        <div className="text-center py-2">
          <span className="text-[0.8rem] opacity-30 tracking-[-0.01em]">
            Loading batch history...
          </span>
        </div>
      )}
      {!batchesLoading && batches.length > 0 && (
        <section className="space-y-3" aria-labelledby="recent-batches-heading">
          <h3
            id="recent-batches-heading"
            className="text-[0.8rem] tracking-[-0.01em] opacity-40 uppercase"
          >
            Recent Batches
          </h3>
          <div className="space-y-2">
            {batches.map(batch => (
              <div
                key={batch.batchId}
                className="grain-gradient bg-gradient-to-br from-white/60 to-white/40 border border-border/15 rounded-xl px-4 py-3 flex items-center justify-between text-[0.8rem]"
              >
                <div className="flex items-center gap-4 opacity-70 tracking-[-0.01em]">
                  <span>{formatBatchDate(batch.createdAt)}</span>
                  <span className="opacity-40">·</span>
                  <span className="tabular-nums">{batch.imageCount} images</span>
                  <span className="opacity-40">·</span>
                  <span className="tabular-nums">
                    {batch.successfulCount} successful
                    {batch.failedCount > 0 && (
                      <span className="text-red-500/70">, {batch.failedCount} failed</span>
                    )}
                  </span>
                </div>
                {batch.csvAvailable &&
                  (redownloadErrors[batch.batchId] ? (
                    <span
                      className="text-[0.75rem] tracking-[-0.01em] text-red-500/70 flex items-center gap-1 max-w-32 truncate"
                      title={redownloadErrors[batch.batchId]}
                    >
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {redownloadErrors[batch.batchId]}
                    </span>
                  ) : redownloadSuccess[batch.batchId] ? (
                    <span className="text-[0.75rem] tracking-[-0.01em] text-green-600/70 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 shrink-0" />
                      Downloaded!
                    </span>
                  ) : (
                    <button
                      onClick={() => handleBatchRedownload(batch.batchId)}
                      disabled={redownloadingId === batch.batchId}
                      className="text-[0.75rem] tracking-[-0.01em] opacity-50 hover:opacity-80 transition-opacity flex items-center gap-1 disabled:opacity-30"
                      aria-label={`Re-download CSV for batch from ${formatBatchDate(batch.createdAt)}`}
                    >
                      <Download className="w-3 h-3" />
                      {redownloadingId === batch.batchId ? 'Downloading...' : 'Re-download'}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
