import { z } from "zod";

const moneyInput = z.union([
  z.number().finite().positive(),
  z.string().regex(/^\d+(?:\.\d{1,2})?$/, "Số tiền không hợp lệ"),
]);

export const paymentDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày nhận phải có định dạng YYYY-MM-DD");

export const paymentBatchCreateSchema = z.object({
  tuitionFeeIds: z.array(z.string().uuid()).min(1).max(100),
  /** Optional per-fee amounts. Missing entries mean the current remaining balance. */
  amounts: z.record(z.string().uuid(), moneyInput).optional(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER"]),
  paymentDate: paymentDateSchema.optional(),
  bankAccountId: z.string().uuid().optional(),
  transactionReference: z.string().trim().max(150).optional(),
  payerName: z.string().trim().max(255).optional(),
  note: z.string().trim().max(1000).optional(),
}).superRefine((data, ctx) => {
  if (data.amounts) {
    for (const feeId of Object.keys(data.amounts)) {
      if (!data.tuitionFeeIds.includes(feeId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amounts", feeId],
          message: "Khoản học phí không nằm trong danh sách thanh toán",
        });
      }
    }
  }
  if (data.paymentMethod === "CASH" && !data.paymentDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["paymentDate"],
      message: "Ngày nhận tiền mặt là bắt buộc",
    });
  }
  if (data.paymentMethod === "BANK_TRANSFER" && data.paymentDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["paymentDate"],
      message: "Ngày chuyển khoản được lấy từ sao kê khi đối soát",
    });
  }
});

export const cashPaymentSchema = z.object({
  paymentDate: paymentDateSchema,
  note: z.string().trim().max(1000, "Ghi chú tối đa 1000 ký tự").optional(),
});

export type PaymentBatchCreate = z.infer<typeof paymentBatchCreateSchema>;
