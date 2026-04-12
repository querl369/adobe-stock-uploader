/**
 * Usage API Routes
 * Story 6.9: Monthly Usage Tracking & Quota Enforcement
 *
 * Protected endpoint for retrieving current month usage data.
 * Requires Supabase JWT in Authorization header.
 */

import express, { Response, Router } from 'express';
import type { Request } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { extractUserId } from '../middleware/auth.middleware';
import { AuthenticationError } from '../../models/errors';
import { services } from '../../config/container';

const router: Router = express.Router();

/**
 * GET /api/usage
 * Story 6.9 AC4: Return current month usage for authenticated user
 */
router.get(
  '/usage',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = await extractUserId(req);

    if (!userId) {
      throw new AuthenticationError('Authentication required');
    }

    const { used, limit, remaining, resetsAt } = await services.usageTracking.getUsage(userId);

    res.json({
      tier: 'free',
      monthlyLimit: limit,
      used,
      remaining,
      resetsAt,
    });
  })
);

export default router;
