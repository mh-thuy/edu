import { z } from "zod";

const reportAllocationSchema = z.object({
  amount: z.coerce.number().nonnegative(),
  tuitionFee: z.object({
    feeNo: z.string(),
    class: z.object({ name: z.string() }),
  }),
});

const reportBatchSchema = z.object({
  batchNo: z.string(),
  totalAmount: z.coerce.number().nonnegative(),
  student: z.object({ code: z.string(), fullName: z.string() }),
  allocations: z.array(reportAllocationSchema),
});

const reportItemSchema = z.object({
  rowNo: z.number().int().positive(),
  transactionDate: z.string().min(1),
  bankTransactionNo: z.string().nullable(),
  description: z.string(),
  creditAmount: z.coerce.number().nonnegative(),
  debitAmount: z.coerce.number().nonnegative(),
  balanceAmount: z.coerce.number().nullable(),
  reconciliationStatus: z.enum([
    "AUTO_MATCHED",
    "UNMATCHED",
    "IGNORED",
    "DUPLICATED",
    "CONFIRMED",
  ]),
  paymentBatches: z.array(reportBatchSchema),
  receiptNos: z.array(z.string()),
  paymentBatchCandidateCount: z.number().int().nonnegative(),
  paymentBatchGroupCandidateCount: z.number().int().nonnegative(),
});

export const bankReconciliationReportSchema = z.object({
  fileName: z.string().min(1).max(255),
  bankName: z.string().min(1).max(120),
  accountNo: z.string().min(1).max(80),
  accountName: z.string().max(160),
  statement: z.object({
    bankFormat: z.enum(["BIDV", "TECHCOMBANK"]),
    fromDate: z.string().nullable(),
    toDate: z.string().nullable(),
    accountNo: z.string().nullable(),
    accountName: z.string().nullable(),
    currencyCode: z.string().nullable(),
    openingBalance: z.coerce.number().nullable(),
    closingBalance: z.coerce.number().nullable(),
  }),
  invalidRowErrors: z.array(z.object({ rowNo: z.number().int().positive(), message: z.string() })),
  items: z.array(reportItemSchema).max(10000),
});

export type BankReconciliationReportInput = z.infer<
  typeof bankReconciliationReportSchema
>;
