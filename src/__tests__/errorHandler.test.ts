import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { errorHandler, AppError } from '../middleware/errorHandler';

// Mock Express Response
const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Mock Express Request and NextFunction
const mockRequest = {} as Request;
const mockNext = jest.fn() as NextFunction;

describe('errorHandler Middleware', () => {
  let res: Response;

  beforeEach(() => {
    res = mockResponse();
    jest.clearAllMocks();
  });

  it('should handle AppError and return corresponding status and message', () => {
    const error = new AppError('Resource not found', 404);

    errorHandler(error, mockRequest, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Resource not found',
    });
  });

  it('should handle ZodError and return 400 with structured validation errors', () => {
    const schema = z.object({
      phone: z.string().min(10, 'Phone must be at least 10 chars'),
    });
    const parseResult = schema.safeParse({ phone: '123' });

    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      errorHandler(parseResult.error, mockRequest, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Validation failed',
        errors: [
          {
            field: 'phone',
            message: 'Phone must be at least 10 chars',
          },
        ],
      });
    }
  });

  it('should handle generic unhandled Error and return 500 with generic message', () => {
    const error = new Error('Database connection lost');

    errorHandler(error, mockRequest, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Something went wrong on the server',
    });
  });
});
