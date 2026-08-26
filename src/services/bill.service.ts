import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export interface CreateBillDTO {
  id?: string;
  customerId?: string;
  customerName?: string;
  itemsJson?: any;
  totalAmount?: number;
  paymentMode?: string;
  paidAmount?: number;
  remainingBalance?: number;
}

export class BillService {
  public async getBills(userId: string) {
    return prisma.bill.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { customer: true },
    });
  }

  public async getBillById(userId: string, id: string) {
    const bill = await prisma.bill.findFirst({
      where: { id, userId },
      include: { customer: true },
    });
    if (!bill) {
      throw new AppError('Bill not found', 404);
    }
    return bill;
  }

  public async createBill(userId: string, data: CreateBillDTO) {
    const billId = data.id || `INV-${Date.now()}`;
    const customerName = data.customerName || 'Walk-in Customer';
    const totalAmount = data.totalAmount || 0;
    const paidAmount = data.paidAmount || 0;
    const remainingBalance = data.remainingBalance !== undefined 
      ? data.remainingBalance 
      : Math.max(totalAmount - paidAmount, 0);

    const bill = await prisma.bill.create({
      data: {
        id: billId,
        userId,
        customerId: data.customerId || null,
        customerName,
        itemsJson: data.itemsJson || [],
        totalAmount,
        paymentMode: data.paymentMode || 'CASH',
        paidAmount,
        remainingBalance,
      },
    });

    // If paid amount > 0, create cashbook entry automatically
    if (paidAmount > 0) {
      await prisma.cashbook.create({
        data: {
          userId,
          billId: bill.id,
          type: 'in',
          amount: paidAmount,
          remarks: `Invoice #${bill.id} Payment (${customerName})`,
        },
      });
    }

    // If remaining balance > 0 and customerId is present, log debit transaction on customer ledger
    if (remainingBalance > 0 && data.customerId) {
      await prisma.transaction.create({
        data: {
          customerId: data.customerId,
          type: 'DEBIT',
          amount: remainingBalance,
          date: new Date(),
          interestStartDate: new Date(),
          remarks: `Credit Sale Invoice #${bill.id}`,
        },
      });
    }

    return bill;
  }

  public async voidBill(userId: string, id: string, reasonData: { reason?: string }) {
    const bill = await this.getBillById(userId, id);
    if (bill.isVoid) {
      throw new AppError('Bill is already voided', 400);
    }

    return prisma.bill.update({
      where: { id },
      data: {
        isVoid: true,
        voidReason: reasonData.reason || 'Voided by merchant',
        voidedAt: new Date(),
      },
    });
  }
}
