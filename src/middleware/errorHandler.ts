import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn(`Operational error: ${err.message} (Status: ${err.statusCode})`);
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  // Unhandled/Programming error: log stack trace and send generic response
  logger.error(`Unhandled error: ${err.message}\nStack: ${err.stack}`);
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong on the server',
  });
};
