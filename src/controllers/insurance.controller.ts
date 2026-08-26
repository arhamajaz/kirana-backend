import { Request, Response, NextFunction } from 'express';
import { InsuranceService } from '../services/insurance.service';

const insuranceService = new InsuranceService();

export class InsuranceController {
  public getInsurance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const insurance = await insuranceService.getInsurance(userId);
      res.status(200).json({
        status: 'success',
        data: insurance,
      });
    } catch (err) {
      next(err);
    }
  };

  public updateInsurance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const insurance = await insuranceService.updateInsurance(userId, req.body);
      res.status(200).json({
        status: 'success',
        data: insurance,
      });
    } catch (err) {
      next(err);
    }
  };
}
