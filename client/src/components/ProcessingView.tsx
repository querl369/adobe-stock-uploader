import { Progress } from './ui/progress';
import type { ProcessingState } from '../types';

interface ProcessingViewProps {
  processing: ProcessingState;
  totalImages: number;
}

export function ProcessingView({ processing, totalImages }: ProcessingViewProps) {
  const progressPercent = totalImages > 0 ? ((processing.currentIndex + 1) / totalImages) * 100 : 0;

  return (
    <div className="grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-2 border-border/20 rounded-2xl p-6 space-y-3">
      <div className="flex items-center justify-between">
        <span className="tracking-[-0.01em] opacity-70 text-[0.875rem]">Processing...</span>
        <span className="tracking-[-0.01em] opacity-50 text-[0.75rem] tabular-nums">
          {processing.currentIndex + 1} / {totalImages}
        </span>
      </div>
      <Progress value={progressPercent} className="h-2" />
      <p className="tracking-[-0.01em] opacity-40 text-[0.75rem] truncate">
        {processing.currentFileName}
      </p>
    </div>
  );
}
