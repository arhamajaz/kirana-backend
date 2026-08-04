import { Request, Response, NextFunction } from 'express';
import { CustomerService } from '../services/customer.service';
import { getCurrentUserId } from '../utils/currentUser';

const customerService = new CustomerService();

export class CustomerController {
  /**
   * Creates a new customer record.
   */
  public createCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = await getCurrentUserId(req);
      const customer = await customerService.createCustomer(userId, req.body);
      res.status(201).json({
        status: 'success',
        data: { customer },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Fetches an active customer by ID.
   */
  public getCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = await getCurrentUserId(req);
      const customer = await customerService.getCustomerById(userId, req.params.id as string);
      res.status(200).json({
        status: 'success',
        data: { customer },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists all active customers of the merchant with pagination and sorting.
   */
  public getAllCustomers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = await getCurrentUserId(req);
      const paginationParams = {
        page: req.query.page as unknown as number,
        limit: req.query.limit as unknown as number,
        sort: req.query.sort as string,
        order: req.query.order as unknown as 'asc' | 'desc',
      };
      const result = await customerService.getAllCustomers(userId, paginationParams);
      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Searches active customers of the merchant with pagination and sorting.
   */
  public searchCustomers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = await getCurrentUserId(req);
      const query = (req.query.q as string) || '';
      const paginationParams = {
        page: req.query.page as unknown as number,
        limit: req.query.limit as unknown as number,
        sort: req.query.sort as string,
        order: req.query.order as unknown as 'asc' | 'desc',
      };
      const result = await customerService.searchCustomers(userId, query, paginationParams);
      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Updates an existing active customer.
   */
  public updateCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = await getCurrentUserId(req);
      const customer = await customerService.updateCustomer(
        userId,
        req.params.id as string,
        req.body,
      );
      res.status(200).json({
        status: 'success',
        data: { customer },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Archives (soft-deletes) a customer.
   */
  public deleteCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = await getCurrentUserId(req);
      await customerService.archiveCustomer(userId, req.params.id as string);
      res.status(200).json({
        status: 'success',
        message: 'Customer archived successfully.',
        data: null,
      });
    } catch (err) {
      next(err);
    }
  };
}
