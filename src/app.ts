import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { config } from './config';
import customerRoutes from './routes/customer.routes';
import transactionRoutes from './routes/transaction.routes';
import authRoutes from './routes/auth.routes';
import itemRoutes from './routes/item.routes';
import billRoutes from './routes/bill.routes';
import cashbookRoutes from './routes/cashbook.routes';
import insuranceRoutes from './routes/insurance.routes';
import reportRoutes from './routes/report.routes';

const app = express();

// Security & Performance Middleware
app.use(helmet());
app.use(compression());

// Environment-controlled CORS configuration
const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true; // Allow non-browser / server-to-server requests
  if (config.CORS_ALLOWED_ORIGINS === '*') return true;
  
  const allowed = config.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  if (allowed.includes(origin)) return true;
  
  // Support Vercel deployment domain patterns (*.vercel.app)
  if (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost:')) return true;
  
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS Error: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Request logging middleware
const morganFormat = config.NODE_ENV === 'development' ? 'dev' : 'combined';
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  }),
);

// Cold-Start Mitigation & Health check endpoints
const healthHandler = (_req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: 'success',
    message: 'Malwa Ledger Pro API Server is healthy and active',
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.get('/api/v1/health', healthHandler);

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/items', itemRoutes);
app.use('/api/v1/bills', billRoutes);
app.use('/api/v1/cashbook', cashbookRoutes);
app.use('/api/v1/insurance', insuranceRoutes);
app.use('/api/v1/reports', reportRoutes);


// Centralized error handling middleware
app.use(errorHandler);

export default app;
