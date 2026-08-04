import { Request } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

/**
 * Retrieves the current merchant's user ID.
 * In Phase 2, this reads from the x-user-id header or falls back to the first user in the database.
 * In Phase 9 (Authentication), this will be refactored to parse JWT claims.
 */
export const getCurrentUserId = async (req: Request): Promise<string> => {
  const headerUserId = req.headers['x-user-id'];
  if (typeof headerUserId === 'string' && headerUserId.trim()) {
    return headerUserId.trim();
  }

  // Fallback to first user in database (seeded test merchant)
  const firstUser = await prisma.user.findFirst();
  if (!firstUser) {
    throw new AppError('No merchant user found in database. Please run seed script.', 400);
  }
  return firstUser.id;
};
