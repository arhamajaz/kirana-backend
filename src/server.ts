import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { disconnectDb } from './config/database';

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}\nStack: ${error.stack}`);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
});

const server = app.listen(config.PORT, () => {
  logger.info(`Server running in ${config.NODE_ENV} mode on port ${config.PORT}`);
});

const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} signal received. Starting graceful shutdown.`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    await disconnectDb();
    logger.info('Shutdown complete.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
