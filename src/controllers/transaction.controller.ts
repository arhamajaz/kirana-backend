import { Request, Response, NextFunction } from 'express';
import {
  TransactionService,
  TransactionFilters,
  PaginationParams,
} from '../services/transaction.service';
import { TransactionType } from '../generated/prisma/client';

const transactionService = new TransactionService();

export class TransactionController {
  /**
   * Creates a new transaction.
   */
  public createTransaction = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const merchantId = req.user.id;
      const transaction = await transactionService.createTransaction(merchantId, req.body);
      res.status(201).json({
        status: 'success',
        data: { transaction },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Retrieves a single transaction by ID.
   */
  public getTransaction = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const merchantId = req.user.id;
      const transaction = await transactionService.getTransactionById(
        merchantId,
        req.params.id as string,
      );
      res.status(200).json({
        status: 'success',
        data: { transaction },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists transactions for a specific customer with pagination, sorting, and filters.
   */
  public getCustomerTransactions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const merchantId = req.user.id;
      const customerId = req.params.customerId as string;

      const filters: TransactionFilters = {
        type: req.query.type as TransactionType | undefined,
        isVoided: req.query.isVoided as 'true' | 'false' | 'all' | undefined,
        startDate: req.query.startDate as Date | undefined,
        endDate: req.query.endDate as Date | undefined,
      };

      const pagination: PaginationParams = {
        page: req.query.page as unknown as number,
        limit: req.query.limit as unknown as number,
        sort: req.query.sort as 'date' | 'amount' | 'interestStartDate' | 'createdAt',
        order: req.query.order as 'asc' | 'desc',
      };

      const result = await transactionService.getCustomerTransactions(
        merchantId,
        customerId,
        filters,
        pagination,
      );

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Voids an active transaction.
   */
  public voidTransaction = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const merchantId = req.user.id;
      const transaction = await transactionService.voidTransaction(
        merchantId,
        req.params.id as string,
      );
      res.status(200).json({
        status: 'success',
        message: 'Transaction voided successfully.',
        data: { transaction },
      });
    } catch (err) {
      next(err);
    }
  };
}
