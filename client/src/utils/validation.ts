export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export const MAX_IMAGE_COUNT = 10;

export interface ValidationError {
  fileName: string;
  reason: string;
}

export interface ValidateFilesOptions {
  isAuthenticated: boolean;
  remainingQuota: number | null;
}

export function validateFiles(
  files: File[],
  currentCount: number,
  options: ValidateFilesOptions = { isAuthenticated: false, remainingQuota: null }
): { valid: File[]; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const valid: File[] = [];

  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      errors.push({
        fileName: file.name,
        reason: 'File type not supported. Use JPG, PNG, or WEBP.',
      });
      continue;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push({
        fileName: file.name,
        reason: 'File too large. Maximum 50MB per image.',
      });
      continue;
    }

    valid.push(file);
  }

  let cap: number | null;
  let overLimitMessage: string;

  if (options.isAuthenticated) {
    cap = options.remainingQuota;
    const remaining = options.remainingQuota ?? 0;
    overLimitMessage = `Only ${remaining} image${remaining === 1 ? '' : 's'} remaining this month.`;
  } else {
    cap = MAX_IMAGE_COUNT;
    overLimitMessage = `Too many files. Anonymous users can process ${MAX_IMAGE_COUNT} images.`;
  }

  if (cap !== null) {
    const availableSlots = cap - currentCount;
    if (valid.length > availableSlots) {
      errors.push({ fileName: '', reason: overLimitMessage });
      valid.length = Math.max(0, availableSlots);
    }
  }

  return { valid, errors };
}
