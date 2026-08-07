import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';

export interface LoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    businessName: string;
  };
}

export class AuthService {
  /**
   * Authenticates a merchant user by email and password, returning a signed JWT.
   */
  public async login(email: string, password: string): Promise<LoginResult> {
    // 1. Find user by email (ensure case-insensitive match)
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      throw new AppError('Invalid email or password.', 401);
    }

    // 2. Compare password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password.', 401);
    }

    // 3. Generate JWT payload and sign
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      config.JWT_SECRET,
      {
        expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
      },
    );

    // 4. Return token and user metadata
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        businessName: user.businessName,
      },
    };
  }
}
