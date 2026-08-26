import { Request, Response, NextFunction } from 'express';
import { CashbookService } from '../services/cashbook.service';

const cashbookService = new CashbookService();

export class CashbookController {
  public getCashbook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const entries = await cashbookService.getCashbook(userId);
      res.status(200).json({
        status: 'success',
        data: entries,
      });
    } catch (err) {
      next(err);
    }
  };

  public createCashbookEntry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const entry = await cashbookService.createCashbookEntry(userId, req.body);
      res.status(201).json({
        status: 'success',
        data: entry,
      });
    } catch (err) {
      next(err);
    }
  };

  public voidCashbookEntry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const entry = await cashbookService.voidCashbookEntry(userId, req.params.id as string, req.body);
      res.status(200).json({
        status: 'success',
        data: entry,
      });
    } catch (err) {
      next(err);
    }
  };
}
