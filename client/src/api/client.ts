import type { UploadResponse, BatchStartResponse, BatchStatusResponse } from '../types';

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(errorData.message || 'Request failed', response.status);
  }
  return response.json();
}

export async function uploadImages(files: File[]): Promise<UploadResponse> {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('images', file);
  });

  const response = await fetch('/api/upload-images', {
    method: 'POST',
    body: formData,
  });

  return handleResponse<UploadResponse>(response);
}

export async function startBatchProcessing(fileIds: string[]): Promise<BatchStartResponse> {
  const response = await fetch('/api/process-batch-v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds }),
  });

  return handleResponse<BatchStartResponse>(response);
}

export async function getBatchStatus(batchId: string): Promise<BatchStatusResponse> {
  const response = await fetch(`/api/batch-status/${batchId}`);
  return handleResponse<BatchStatusResponse>(response);
}

export async function cleanup(): Promise<void> {
  const response = await fetch('/api/cleanup', { method: 'POST' });
  if (!response.ok) {
    throw new ApiError('Cleanup failed', response.status);
  }
}
