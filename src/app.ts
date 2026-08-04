import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
const morganFormat = process.env.NODE_ENV === 'development' ? 'dev' : 'combined';
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  }),
);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
  });
});

// Centralized error handling middleware
app.use(errorHandler);

export default app;
