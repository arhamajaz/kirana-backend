import { Request, Response, NextFunction } from 'express';
import { CustomerService } from '../services/customer.service';

const customerService = new CustomerService();

export class ReportController {
  public getReportSummary = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      let totalCustomers = 0;

      if (userId) {
        const result = await customerService.getAllCustomers(userId, {
          page: 1,
          limit: 1000,
          sort: 'createdAt',
          order: 'desc',
        });
        totalCustomers = result.customers.length;
      }

      res.status(200).json({
        status: 'success',
        data: {
          totalCustomers,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
