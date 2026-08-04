import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { config } from './index';
import { logger } from '../utils/logger';

const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 1,
});

pool.on('error', (err) => {
  logger.error(`Unexpected database pool error: ${err.message}\nStack: ${err.stack}`);
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

export const disconnectDb = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    await pool.end();
    logger.info('Database pool closed successfully.');
  } catch (err) {
    logger.error(
      `Error closing database pool: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};
