import { prisma } from '../config/database';
import { Prisma, Transaction, TransactionType } from '../generated/prisma/client';
import { AppError } from '../middleware/errorHandler';

export interface CreateTransactionInput {
  customerId: string;
  type: TransactionType;
  amount: number;
  date: Date;
  interestStartDate: Date;
  remarks?: string | null;
}

export interface TransactionFilters {
  type?: TransactionType;
  isVoided?: 'true' | 'false' | 'all';
  startDate?: Date;
  endDate?: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sort: 'date' | 'amount' | 'interestStartDate' | 'createdAt';
  order: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  transactions: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export class TransactionService {
  /**
   * Creates a new transaction atomically.
   * Verifies the customer exists, is active, and belongs to the merchant.
   */
  public async createTransaction(
    merchantId: string,
    data: CreateTransactionInput,
  ): Promise<Transaction> {
    return prisma.$transaction(async (tx) => {
      // 1. Verify customer exists, belongs to the merchant, and is active
      const customer = await tx.customer.findFirst({
        where: {
          id: data.customerId,
          userId: merchantId,
          isActive: true,
        },
      });

      if (!customer) {
        throw new AppError('Customer not found.', 404);
      }

      // 2. Create the transaction record
      return tx.transaction.create({
        data: {
          customerId: data.customerId,
          type: data.type,
          amount: data.amount,
          date: data.date,
          interestStartDate: data.interestStartDate,
          remarks: data.remarks || null,
          isVoided: false,
        },
      });
    });
  }

  /**
   * Retrieves a single transaction by ID.
   * Verifies the owner of the customer belongs to the merchant.
   */
  public async getTransactionById(merchantId: string, id: string): Promise<Transaction> {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
      },
      include: {
        customer: true,
      },
    });

    if (
      !transaction ||
      transaction.customer.userId !== merchantId ||
      !transaction.customer.isActive
    ) {
      throw new AppError('Transaction not found.', 404);
    }

    // Exclude the nested customer relation to match exact response contract
    const transactionData: Transaction = {
      id: transaction.id,
      customerId: transaction.customerId,
      type: transaction.type,
      amount: transaction.amount,
      date: transaction.date,
      interestStartDate: transaction.interestStartDate,
      remarks: transaction.remarks,
      isVoided: transaction.isVoided,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
    return transactionData;
  }

  /**
   * Lists customer transactions with pagination, sorting, and filters.
   * Verifies customer existence, active status, and merchant ownership.
   */
  public async getCustomerTransactions(
    merchantId: string,
    customerId: string,
    filters: TransactionFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Transaction>> {
    // 1. Validate customer existence and ownership
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        userId: merchantId,
        isActive: true,
      },
    });

    if (!customer) {
      throw new AppError('Customer not found.', 404);
    }

    const { page, limit, sort, order } = pagination;
    const skip = (page - 1) * limit;
    const take = limit;

    // Stable sorting logic: Secondary sort by createdAt DESC to avoid unstable pagination
    const orderBy: Prisma.TransactionOrderByWithRelationInput[] = [
      { [sort]: order },
      { createdAt: 'desc' },
    ];

    // Construct filtering query
    const where: Prisma.TransactionWhereInput = {
      customerId,
    };

    if (filters.type) {
      where.type = filters.type;
    }

    const isVoidedStr = filters.isVoided ?? 'false';
    if (isVoidedStr === 'false') {
      where.isVoided = false;
    } else if (isVoidedStr === 'true') {
      where.isVoided = true;
    }
    // If 'all', we omit the where.isVoided clause entirely to return both types

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.date.lte = filters.endDate;
      }
    }

    // Parallel execution of paginated fetch and total count
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
      prisma.transaction.count({
        where,
      }),
    ]);

    // Handle 0 record edge case consistently
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  /**
   * Voids a transaction idempotently.
   * Verifies the owner of the customer belongs to the merchant.
   */
  public async voidTransaction(merchantId: string, id: string): Promise<Transaction> {
    // 1. Fetch transaction and verify ownership
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
      },
      include: {
        customer: true,
      },
    });

    if (
      !transaction ||
      transaction.customer.userId !== merchantId ||
      !transaction.customer.isActive
    ) {
      throw new AppError('Transaction not found.', 404);
    }

    // 2. Perform idempotency check
    if (transaction.isVoided) {
      throw new AppError('Transaction is already voided.', 400);
    }

    // 3. Mark the transaction as voided
    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        isVoided: true,
      },
    });

    return updated;
  }
}
