import type {
  UploadResponse,
  BatchStartResponse,
  BatchStatusResponse,
  BatchHistoryResponse,
} from '../types';

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function categorizeHttpError(
  response: Response,
  fallbackMessage = 'Request failed'
): Promise<never> {
  if (response.status === 429) {
    throw new ApiError('Free limit reached. Create an account for 100 images/month.', 429);
  }
  if (response.status === 408 || response.status === 504) {
    throw new ApiError('Request timed out. Please try again.', response.status);
  }
  if (response.status >= 500) {
    throw new ApiError('Something went wrong. Please try again.', response.status);
  }
  const errorData = await response.json().catch(() => ({ message: fallbackMessage }));
  throw new ApiError(errorData.message || 'Something went wrong', response.status);
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    await categorizeHttpError(response);
  }
  return response.json();
}

async function safeFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError('Connection lost. Check your internet and try again.', 0);
  }
}

export async function uploadImages(files: File[]): Promise<UploadResponse> {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('images', file);
  });

  const response = await safeFetch('/api/upload-images', {
    method: 'POST',
    body: formData,
  });

  return handleResponse<UploadResponse>(response);
}

export async function startBatchProcessing(fileIds: string[]): Promise<BatchStartResponse> {
  const response = await safeFetch('/api/process-batch-v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds }),
  });

  return handleResponse<BatchStartResponse>(response);
}

export async function getBatchStatus(batchId: string): Promise<BatchStatusResponse> {
  const response = await safeFetch(`/api/batch-status/${batchId}`);
  return handleResponse<BatchStatusResponse>(response);
}

export async function cleanup(): Promise<void> {
  const response = await safeFetch('/api/cleanup', { method: 'POST' });
  if (!response.ok) {
    await categorizeHttpError(response, 'Cleanup failed');
  }
}

export async function getBatches(options?: {
  signal?: AbortSignal;
}): Promise<BatchHistoryResponse> {
  const response = await safeFetch('/api/batches', { signal: options?.signal });
  return handleResponse<BatchHistoryResponse>(response);
}

export async function downloadBatchCsv(batchId: string): Promise<void> {
  const response = await safeFetch(`/api/download-csv/${batchId}`);
  if (!response.ok) {
    await categorizeHttpError(response, 'Download failed');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  const filename = disposition?.match(/filename="?([^"]+)"?/)?.[1] || `batch-${batchId}.csv`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
