import 'express';

declare global {
  namespace Express {
    export interface AuthUser {
      id: string;
      email: string;
      businessName: string;
    }

    export interface Request {
      user: AuthUser;
    }
  }
}
