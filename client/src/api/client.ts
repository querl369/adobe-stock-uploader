import { supabase } from '../lib/supabase';
import type {
  UploadResponse,
  BatchStartResponse,
  BatchStatusResponse,
  BatchHistoryResponse,
  UsageResponse,
} from '../types';

/**
 * Get the current Supabase access token for authenticated API requests.
 * Returns null for anonymous users or when Supabase is unavailable.
 */
async function getAuthToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Build headers with optional Authorization token.
 */
async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { ...extra };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

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
    const errorData = await response.json().catch(() => null);
    throw new ApiError(
      errorData?.error?.message ||
        errorData?.message ||
        'Free limit reached. Create an account for 100 images/month.',
      429
    );
  }
  if (response.status === 408 || response.status === 504) {
    throw new ApiError('Request timed out. Please try again.', response.status);
  }
  if (response.status >= 500) {
    throw new ApiError('Something went wrong. Please try again.', response.status);
  }
  const errorData = await response.json().catch(() => ({ message: fallbackMessage }));
  throw new ApiError(
    errorData.error?.message || errorData.message || 'Something went wrong',
    response.status
  );
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

  // Don't set Content-Type — browser sets it with boundary for multipart/form-data
  const response = await safeFetch('/api/upload-images', {
    method: 'POST',
    headers: await authHeaders(),
    body: formData,
  });

  return handleResponse<UploadResponse>(response);
}

export async function startBatchProcessing(fileIds: string[]): Promise<BatchStartResponse> {
  const response = await safeFetch('/api/process-batch-v2', {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
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

/**
 * Persist CSV to server so it can be re-downloaded from History.
 * Fire-and-forget — failure is non-fatal.
 * Includes initials in each record's "releases" field so re-downloads match the original CSV.
 */
export async function persistCsvToServer(
  metadataList: Array<{ filename: string; title: string; keywords: string; category: number }>,
  batchId: string,
  initials: string
): Promise<void> {
  try {
    const metadataWithReleases = metadataList.map(item => ({
      ...item,
      releases: initials,
    }));
    await safeFetch('/api/generate-csv', {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ metadataList: metadataWithReleases, batchId }),
    });
  } catch {
    // Non-fatal — user already has the client-side download
  }
}

export async function getBatches(options?: {
  signal?: AbortSignal;
}): Promise<BatchHistoryResponse> {
  const response = await safeFetch('/api/batches', { signal: options?.signal });
  return handleResponse<BatchHistoryResponse>(response);
}

export async function getUsage(): Promise<UsageResponse> {
  const response = await safeFetch('/api/usage', {
    headers: await authHeaders(),
  });
  return handleResponse<UsageResponse>(response);
}

export async function downloadBatchCsv(batchId: string): Promise<void> {
  const response = await safeFetch(`/api/download-csv/${batchId}`, {
    headers: await authHeaders(),
    credentials: 'include',
  });
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
