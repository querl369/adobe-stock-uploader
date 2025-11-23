/**
 * Upload API Routes
 * Story 2.1: Batch Upload API Endpoint
 *
 * Handles batch image upload for anonymous users (up to 10 images)
 * Supports JPG, PNG, WEBP formats with validation
 * Cookie-based session tracking for anonymous user limits
 */

import express, { Response, Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { asyncHandler } from '../middleware/error-handler';
import { ValidationError, RateLimitError, ProcessingError } from '../../models/errors';
import { logger } from '../../utils/logger';
import { config } from '../../config/app.config';
import {
  sessionMiddleware,
  SessionRequest,
  getSessionUsageMessage,
} from '../middleware/session.middleware';
import {
  ipRateLimitMiddleware,
  sessionUploadLimitMiddleware,
} from '../middleware/rate-limit.middleware';
import { sessionService } from '../../services/session.service';

const router: Router = express.Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  logger.info({ path: UPLOADS_DIR }, 'Uploads directory created');
}

/**
 * File validation middleware
 * Story 2.1 AC1: Validate MIME types (JPG, PNG, WEBP)
 * Story 2.1 AC2: Enforce max 50MB per file
 */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = config.processing.maxFileSizeMB * 1024 * 1024; // Convert MB to bytes

/**
 * Multer configuration for batch upload
 * Story 2.1 AC5: Save files to disk with UUID naming
 * Format: /uploads/{uuid}-{original-name}
 */
const uploadMultiple = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      callback(null, UPLOADS_DIR);
    },
    filename: (req, file, callback) => {
      // Story 2.1 AC5: UUID-based filename
      const uuid = randomUUID();
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `${uuid}-${sanitizedName}`;
      callback(null, filename);
    },
  }),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // Story 2.1 AC3: Max 10 files for anonymous users
  },
  fileFilter: (req, file, callback) => {
    // Story 2.1 AC1: Validate MIME types
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(
        new ValidationError(
          `Invalid file type: ${file.mimetype}. Only JPG, PNG, and WEBP are allowed.`
        )
      );
      return;
    }
    callback(null, true);
  },
});

/**
 * Validate image file is not corrupted
 * Story 2.1 AC8: Validate files are not corrupted
 */
async function validateImageIntegrity(filePath: string): Promise<boolean> {
  try {
    // Use Sharp to validate the image can be read
    const metadata = await sharp(filePath).metadata();
    return metadata.width !== undefined && metadata.height !== undefined;
  } catch (error) {
    logger.warn({ filePath, error }, 'Image validation failed - corrupted file');
    return false;
  }
}

/**
 * POST /api/upload-images
 * Story 2.1: Batch Upload API Endpoint
 *
 * Accepts 1-10 images from anonymous users
 * Returns file IDs and upload confirmation
 *
 * @body multipart/form-data with 'images' field (array of files)
 * @returns {success: boolean, files: Array<{id, name, size}>, sessionUsage: string}
 */
router.post(
  '/upload-images',
  sessionMiddleware, // Story 2.2: Create/validate session cookie
  ipRateLimitMiddleware, // Story 2.3: Per-IP rate limiting
  asyncHandler(async (req: SessionRequest, res: Response, next) => {
    // First, run multer to handle file upload
    uploadMultiple.array('images', 10)(req, res, async err => {
      if (err) {
        // Multer errors
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return next(
              new ProcessingError(
                'FILE_TOO_LARGE',
                'File too large. Maximum size is 50MB per file.',
                413
              )
            );
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return next(new ValidationError('Too many files. Maximum 10 files allowed.'));
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return next(
              new ValidationError('Unexpected field name. Use "images" for file uploads.')
            );
          }
        }
        return next(err);
      }

      try {
        const files = req.files as Express.Multer.File[];
        const sessionId = req.sessionId!;

        // Story 2.1 AC6: Return error 400 if no files
        if (!files || files.length === 0) {
          throw new ValidationError('No files uploaded. Please upload 1-10 images.');
        }

        // Story 2.1 AC3 & Story 2.3: Enforce session-based rate limit
        // Check if adding these files would exceed the limit
        const currentUsage = sessionService.getSessionUsage(sessionId);
        const remaining = sessionService.getRemainingImages(sessionId);

        if (files.length > remaining) {
          // Clean up uploaded files before throwing error
          files.forEach(file => {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          });

          throw new RateLimitError(
            `Upload would exceed anonymous limit. You have ${remaining} of 10 free images remaining. ` +
              `You tried to upload ${files.length} images. Please create an account for higher limits.`,
            3600 // 1 hour retry
          );
        }

        req.log.info(
          {
            fileCount: files.length,
            sessionId,
            currentUsage,
            remaining,
          },
          'Batch upload started'
        );

        // Story 2.1 AC8: Validate files are not corrupted
        const validatedFiles: Express.Multer.File[] = [];
        const corruptedFiles: string[] = [];

        for (const file of files) {
          const isValid = await validateImageIntegrity(file.path);
          if (isValid) {
            validatedFiles.push(file);
          } else {
            corruptedFiles.push(file.originalname);
            // Delete corrupted file
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          }
        }

        if (corruptedFiles.length > 0) {
          req.log.warn({ corruptedFiles }, 'Corrupted files detected and removed');

          // If ALL files were corrupted, return error
          if (validatedFiles.length === 0) {
            throw new ValidationError(
              `All uploaded files are corrupted or invalid. Files: ${corruptedFiles.join(', ')}`
            );
          }
        }

        // Update session usage with validated file count
        sessionService.incrementUsage(sessionId, validatedFiles.length);

        // Process each validated file and prepare response
        const uploadedFiles = validatedFiles.map(file => {
          // File already has UUID in filename from multer diskStorage
          const fileId = path.basename(file.path);

          req.log.debug(
            {
              fileId,
              originalName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
              path: file.path,
            },
            'File validated and saved'
          );

          return {
            id: fileId,
            name: file.originalname,
            size: file.size,
          };
        });

        const updatedUsage = sessionService.getSessionUsage(sessionId);
        const updatedRemaining = sessionService.getRemainingImages(sessionId);

        req.log.info(
          {
            fileCount: uploadedFiles.length,
            sessionId,
            sessionUsage: updatedUsage,
            remaining: updatedRemaining,
            corruptedCount: corruptedFiles.length,
          },
          'Batch upload completed'
        );

        // Story 2.1 AC4: Return success response with file IDs and upload confirmation
        // Story 2.2: Include session usage feedback
        const response: any = {
          success: true,
          files: uploadedFiles,
          message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
          sessionUsage: getSessionUsageMessage(sessionId),
        };

        // Include warning if some files were corrupted
        if (corruptedFiles.length > 0) {
          response.warning = `${corruptedFiles.length} file(s) were corrupted and skipped: ${corruptedFiles.join(', ')}`;
        }

        res.json(response);
      } catch (error) {
        next(error);
      }
    });
  })
);

export default router;
