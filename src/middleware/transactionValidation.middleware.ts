import { z } from 'zod';
import { validateBody, validateQuery } from './validation.middleware';

/**
 * Zod schema for creating a new ledger transaction.
 */
export const createTransactionSchema = z
  .object({
    customerId: z.string().uuid('Invalid customer ID format'),
    type: z.enum(['DEBIT', 'CREDIT'], {
      message: 'Transaction type must be DEBIT or CREDIT',
    }),
    amount: z.coerce
      .number()
      .positive('Amount must be greater than zero')
      .max(99999999999.99, 'Amount cannot exceed maximum transaction limit')
      .refine(
        (val) => {
          const strVal = val.toString();
          const dotIdx = strVal.indexOf('.');
          if (dotIdx !== -1) {
            const decimalPart = strVal.slice(dotIdx + 1);
            if (decimalPart.includes('e')) return false; // Reject scientific notation formats
            return decimalPart.length <= 2;
          }
          return true;
        },
        { message: 'Amount cannot have more than 2 decimal places' },
      ),
    date: z.coerce.date().refine((d) => d <= new Date(), {
      message: 'Transaction date cannot be in the future',
    }),
    interestStartDate: z.coerce.date().refine((d) => d <= new Date(), {
      message: 'Interest start date cannot be in the future',
    }),
    remarks: z
      .string()
      .max(500, 'Remarks cannot exceed 500 characters')
      .transform((val) => val.trim())
      .optional()
      .nullable(),
  })
  .refine((data) => data.interestStartDate >= data.date, {
    message: 'Interest start date cannot be before the transaction date',
    path: ['interestStartDate'],
  });

/**
 * Zod schema for listing/searching transactions with pagination, sorting, and filters.
 */
export const listTransactionsSchema = z
  .object({
    page: z.coerce
      .number()
      .int('Page must be an integer')
      .min(1, 'Page must be at least 1')
      .default(1),
    limit: z.coerce
      .number()
      .int('Limit must be an integer')
      .min(1, 'Limit must be at least 1')
      .max(100, 'Limit cannot exceed 100')
      .default(20),
    sort: z.enum(['date', 'amount', 'interestStartDate', 'createdAt']).default('date'),
    order: z.enum(['asc', 'desc']).default('desc'),
    type: z.enum(['DEBIT', 'CREDIT']).optional(),
    isVoided: z.enum(['true', 'false', 'all']).default('false'),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'End date cannot be before start date',
      path: ['endDate'],
    },
  );

/**
 * Validation middlewares
 */
export const validateCreateTransaction = validateBody(createTransactionSchema);
export const validateListTransactions = validateQuery(listTransactionsSchema);
