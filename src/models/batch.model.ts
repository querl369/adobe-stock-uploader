/**
 * Batch Models
 * Story 2.6: Processing Status & Progress Tracking
 *
 * Defines TypeScript interfaces for batch processing state tracking.
 * Used for status API endpoint and progress monitoring.
 */

import type { ProcessingResult } from './metadata.model';

/**
 * Status of a batch processing operation
 */
export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Status of an individual image within a batch
 */
export type ImageStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Individual image tracking within a batch
 */
export interface BatchImage {
  /**
   * Unique identifier for the image (file ID from upload)
   */
  id: string;

  /**
   * Original filename
   */
  filename: string;

  /**
   * Current processing status
   */
  status: ImageStatus;

  /**
   * Error message (only present if status = 'failed')
   */
  error?: string;

  /**
   * Processing result (only present if status = 'completed')
   */
  result?: ProcessingResult;
}

/**
 * Progress counts for batch status
 */
export interface BatchProgressCounts {
  /**
   * Total number of images in the batch
   */
  total: number;

  /**
   * Number of images completed successfully
   */
  completed: number;

  /**
   * Number of images that failed
   */
  failed: number;

  /**
   * Number of images currently being processed
   */
  processing: number;

  /**
   * Number of images waiting to be processed
   */
  pending: number;
}

/**
 * Complete batch state for tracking and API response
 */
export interface BatchState {
  /**
   * Unique batch identifier (UUID)
   */
  batchId: string;

  /**
   * Session ID that owns this batch
   */
  sessionId: string;

  /**
   * Overall batch status
   */
  status: BatchStatus;

  /**
   * Progress counts
   */
  progress: BatchProgressCounts;

  /**
   * Per-image status tracking
   */
  images: BatchImage[];

  /**
   * Estimated time remaining in seconds
   */
  estimatedTimeRemaining?: number;

  /**
   * Average processing time per image in milliseconds
   */
  avgProcessingTimeMs?: number;

  /**
   * Timestamp when batch was created
   */
  createdAt: Date;

  /**
   * Timestamp when batch was last updated
   */
  updatedAt: Date;

  /**
   * Timestamp when batch completed (success or failure)
   */
  completedAt?: Date;
}

/**
 * Request body for POST /api/process-batch
 */
export interface ProcessBatchRequest {
  /**
   * Array of file IDs from upload response
   */
  fileIds: string[];
}

/**
 * API response for GET /api/batch-status/:batchId
 */
export interface BatchStatusResponse {
  /**
   * Unique batch identifier
   */
  batchId: string;

  /**
   * Overall batch status
   */
  status: BatchStatus;

  /**
   * Progress counts
   */
  progress: BatchProgressCounts;

  /**
   * Per-image status (simplified for API response)
   */
  images: Array<{
    id: string;
    filename: string;
    status: ImageStatus;
    error?: string;
  }>;

  /**
   * Estimated time remaining in seconds
   */
  estimatedTimeRemaining?: number;

  /**
   * ISO timestamp when batch was created
   */
  createdAt: string;
}

/**
 * Options for creating a new batch
 */
export interface CreateBatchOptions {
  /**
   * Session ID that owns this batch
   */
  sessionId: string;

  /**
   * Array of files with IDs and filenames
   */
  files: Array<{
    id: string;
    filename: string;
  }>;
}
