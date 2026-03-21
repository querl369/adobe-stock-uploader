export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export const MAX_IMAGE_COUNT = 10;

export interface ValidationError {
  fileName: string;
  reason: string;
}

export function validateFiles(
  files: File[],
  currentCount: number
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

  const availableSlots = MAX_IMAGE_COUNT - currentCount;
  if (valid.length > availableSlots) {
    errors.push({
      fileName: '',
      reason: `Too many files. Anonymous users can process ${MAX_IMAGE_COUNT} images.`,
    });
    valid.length = Math.max(0, availableSlots);
  }

  return { valid, errors };
}
