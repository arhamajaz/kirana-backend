import { Request, Response, NextFunction } from 'express';
import { ItemService } from '../services/item.service';

const itemService = new ItemService();

export class ItemController {
  public getItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const items = await itemService.getItems(userId);
      res.status(200).json({
        status: 'success',
        data: items,
      });
    } catch (err) {
      next(err);
    }
  };

  public createItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const item = await itemService.createItem(userId, req.body);
      res.status(201).json({
        status: 'success',
        data: item,
      });
    } catch (err) {
      next(err);
    }
  };

  public updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const item = await itemService.updateItem(userId, req.params.id as string, req.body);
      res.status(200).json({
        status: 'success',
        data: item,
      });
    } catch (err) {
      next(err);
    }
  };

  public deleteItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      await itemService.deleteItem(userId, req.params.id as string);
      res.status(200).json({
        status: 'success',
        message: 'Item deleted successfully.',
        data: { success: true },
      });
    } catch (err) {
      next(err);
    }
  };
}
