import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';

const authService = new AuthService();

export class AuthController {
  /**
   * Handles merchant login requests.
   */
  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Handles merchant registration requests.
   */
  public register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, name, businessName } = req.body;
      const result = await authService.register(email, password, name, businessName);
      res.status(201).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
