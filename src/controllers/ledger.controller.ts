import { Request, Response, NextFunction } from 'express';
import { LedgerService } from '../services/ledger.service';
import { AppError } from '../middleware/errorHandler';

const ledgerService = new LedgerService();

export class LedgerController {
  /**
   * Fetch customer ledger with dynamic interest calculations.
   */
  public getCustomerLedger = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const customerId = req.params.customerId as string;
      const { id: userId } = req.user;

      // Extract optional calculationDate or asOfDate query parameter
      const rawDateParam = (req.query.calculationDate || req.query.asOfDate) as string | undefined;
      let calculationDate = new Date();

      if (rawDateParam) {
        const parsedDate = new Date(rawDateParam);
        if (isNaN(parsedDate.getTime())) {
          throw new AppError('Invalid calculationDate or asOfDate query parameter.', 400);
        }
        calculationDate = parsedDate;
      }

      const result = await ledgerService.generateLedger(userId, customerId, calculationDate);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
