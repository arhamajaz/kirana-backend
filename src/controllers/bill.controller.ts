import { Request, Response, NextFunction } from 'express';
import { BillService } from '../services/bill.service';

const billService = new BillService();

export class BillController {
  public getBills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const bills = await billService.getBills(userId);
      res.status(200).json({
        status: 'success',
        data: bills,
      });
    } catch (err) {
      next(err);
    }
  };

  public createBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const bill = await billService.createBill(userId, req.body);
      res.status(201).json({
        status: 'success',
        data: bill,
      });
    } catch (err) {
      next(err);
    }
  };

  public voidBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const bill = await billService.voidBill(userId, req.params.id as string, req.body);
      res.status(200).json({
        status: 'success',
        data: bill,
      });
    } catch (err) {
      next(err);
    }
  };
}
