import app from './app';
import { config } from './config';
import { logger } from './utils/logger';

const server = app.listen(config.PORT, () => {
  logger.info(`Server running in ${config.NODE_ENV} mode on port ${config.PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received. Shutting down gracefully.');
  server.close(() => {
    logger.info('Http server closed.');
  });
});
