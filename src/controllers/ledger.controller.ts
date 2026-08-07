import { Request, Response, NextFunction } from 'express';
import { LedgerService } from '../services/ledger.service';

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

      // Extract optional calculationDate query parameter
      let calculationDate = new Date();
      if (req.query.calculationDate) {
        calculationDate = new Date(req.query.calculationDate as string);
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
