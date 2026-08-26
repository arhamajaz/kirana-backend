import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export interface CreateCashbookEntryDTO {
  type: string; // 'in' | 'out'
  amount: number;
  remarks?: string;
  billId?: string;
}

export class CashbookService {
  public async getCashbook(userId: string) {
    return prisma.cashbook.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }

  public async createCashbookEntry(userId: string, data: CreateCashbookEntryDTO) {
    if (!data.type || !['in', 'out'].includes(data.type.toLowerCase())) {
      throw new AppError('Type must be either "in" or "out"', 400);
    }
    if (data.amount === undefined || data.amount <= 0) {
      throw new AppError('Amount must be greater than 0', 400);
    }

    return prisma.cashbook.create({
      data: {
        userId,
        type: data.type.toLowerCase(),
        amount: data.amount,
        remarks: data.remarks || null,
        billId: data.billId || null,
      },
    });
  }

  public async voidCashbookEntry(userId: string, id: string, reasonData: { reason?: string }) {
    const entry = await prisma.cashbook.findFirst({
      where: { id, userId },
    });
    if (!entry) {
      throw new AppError('Cashbook entry not found', 404);
    }
    if (entry.isVoid) {
      throw new AppError('Entry is already voided', 400);
    }

    return prisma.cashbook.update({
      where: { id },
      data: {
        isVoid: true,
        voidReason: reasonData.reason || 'Voided by merchant',
        voidedAt: new Date(),
      },
    });
  }
}
