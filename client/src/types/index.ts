export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  description?: string;
  title?: string;
  keywords?: string;
  category?: number;
  fileId?: string;
}

export interface UploadResponse {
  success: boolean;
  files: Array<{ id: string; name: string; size: number }>;
  sessionUsage: string;
}

export interface BatchStartResponse {
  success: boolean;
  batchId: string;
  message: string;
}

export interface BatchImageStatus {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  metadata?: {
    title: string;
    keywords: string;
    category: number;
  };
  error?: string;
}

export interface BatchStatusResponse {
  batchId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: {
    total: number;
    completed: number;
    failed: number;
    processing: number;
    pending: number;
  };
  images: BatchImageStatus[];
  estimatedTimeRemaining?: number;
}

export interface BatchHistoryItem {
  batchId: string;
  status: string;
  imageCount: number;
  successfulCount: number;
  failedCount: number;
  csvFileName: string | null;
  createdAt: string;
  completedAt: string;
  expiresAt: string;
  csvAvailable: boolean;
}

export interface BatchHistoryResponse {
  success: boolean;
  batches: BatchHistoryItem[];
}

export type AppView = 'upload' | 'processing' | 'results';
