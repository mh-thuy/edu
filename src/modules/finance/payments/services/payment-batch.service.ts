import {
  Prisma,
  TuitionFeeStatus,
  TuitionPaymentStatus,
  PaymentBatchStatus,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditFields, type AuditContext } from "@/lib/audit";
import type {
  ClassNoticeBatchCreate,
  NoticeBatchCreate,
  PaymentBatchCreate,
  PendingBatchRestructure,
} from "../schemas/payment-batch.schema";
import { parseVietnamDateStart } from "@/lib/vietnam-time";
import { vietnameseAmountInWords } from "@/lib/vietnamese-amount";
import { buildVietQrUrl } from "@/modules/finance/tuition/services/vietqr.service";
import {
  getEffectiveTuitionFeeStatus,
  PARTIAL_FEE_STATUS,
  getStoredTuitionFeeStatus,
} from "@/modules/finance/tuition/utils/tuition-status";
import {
  savePaymentBatchNoticeSnapshot,
  savePaymentBatchReceiptSnapshot,
  saveTuitionReceiptSnapshot,
  toFeeSnapshot,
  type DocumentSnapshot,
} from "./payment-document-snapshot";

function parsePaymentDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parseVietnamDateStart(value);
  if (!parsed) throw new ConflictError("Ngày nhận không hợp lệ");
  return parsed;
}

async function lockTuitionFeeRows(
  tx: Prisma.TransactionClient,
  feeIds: string[],
) {
  if (!feeIds.length) return;
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM tuition_fees
    WHERE id IN (${Prisma.join(feeIds.map((id) => Prisma.sql`${id}::uuid`))})
    ORDER BY id
    FOR UPDATE
  `);
}

async function lockPaymentBatchRows(
  tx: Prisma.TransactionClient,
  batchIds: string[],
) {
  if (!batchIds.length) return;
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM payment_batches
    WHERE id IN (${Prisma.join(batchIds.map((id) => Prisma.sql`${id}::uuid`))})
    ORDER BY id
    FOR UPDATE
  `);
}

async function lockStudentRows(
  tx: Prisma.TransactionClient,
  studentIds: string[],
) {
  const sortedIds = [...new Set(studentIds)].sort();
  if (!sortedIds.length) return;
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtext(student_id))
    FROM (VALUES ${Prisma.join(sortedIds.map((id) => Prisma.sql`(${id})`))}) AS students(student_id)
    ORDER BY student_id
  `);
}

function sumSuccessfulPayments(payments: Array<{ amount: Prisma.Decimal }>) {
  return payments.reduce(
    (total, payment) => total.add(payment.amount),
    new Prisma.Decimal(0),
  );
}

async function generateBatchNo(tx: Prisma.TransactionClient) {
  const prefix = `PB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  for (let index = 0; index < 5; index += 1) {
    const candidate = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    if (
      !(await tx.paymentBatch.findUnique({
        where: { batchNo: candidate },
        select: { id: true },
      }))
    )
      return candidate;
  }
  throw new ConflictError("Không thể tạo mã thanh toán tổng, vui lòng thử lại");
}

async function generateBatchNumbers(
  tx: Prisma.TransactionClient,
  count: number,
) {
  const prefix = `PB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  const available = new Set<string>();
  while (available.size < count) {
    const candidates = Array.from(
      { length: Math.max(count - available.size, 8) },
      () => `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`,
    );
    const uniqueCandidates = [...new Set(candidates)].filter(
      (value) => !available.has(value),
    );
    const existing = await tx.paymentBatch.findMany({
      where: { batchNo: { in: uniqueCandidates } },
      select: { batchNo: true },
    });
    const existingNumbers = new Set(existing.map((batch) => batch.batchNo));
    for (const candidate of uniqueCandidates) {
      if (!existingNumbers.has(candidate)) available.add(candidate);
      if (available.size === count) break;
    }
  }
  return [...available];
}

function sameNullableText(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  return (left?.trim() || null) === (right?.trim() || null);
}

async function findIdempotentBatch(
  tx: Prisma.TransactionClient,
  data: PaymentBatchCreate,
) {
  if (!data.idempotencyKey) return null;

  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`payment-idempotency:${data.idempotencyKey}`}))`,
  );
  const existingRows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT id FROM payment_batches WHERE idempotency_key = ${data.idempotencyKey} LIMIT 1 FOR UPDATE`,
  );
  const existingId = existingRows[0]?.id;
  const existing = existingId
    ? await tx.paymentBatch.findUnique({
        where: { id: existingId },
        include: {
          allocations: {
            include: {
              tuitionFee: {
                include: {
                  payments: {
                    where: { paymentStatus: TuitionPaymentStatus.SUCCESS },
                    select: { amount: true, paymentBatchId: true },
                  },
                },
              },
            },
          },
          student: true,
          receipt: true,
        },
      })
    : null;
  if (!existing) return null;

  const requestedFeeIds = new Set(data.tuitionFeeIds);
  const existingFeeIds = new Set(
    existing.allocations.map((allocation) => allocation.tuitionFeeId),
  );
  const sameFees =
    requestedFeeIds.size === data.tuitionFeeIds.length &&
    requestedFeeIds.size === existingFeeIds.size &&
    [...requestedFeeIds].every((feeId) => existingFeeIds.has(feeId));
  const sameAmounts =
    sameFees &&
    existing.allocations.every((allocation) => {
      const requested = data.amounts?.[allocation.tuitionFeeId];
      const paidAmount = sumSuccessfulPayments(allocation.tuitionFee.payments);
      const existingBatchAmount = sumSuccessfulPayments(
        allocation.tuitionFee.payments.filter(
          (payment) => payment.paymentBatchId === existing.id,
        ),
      );
      const remainingAmount = allocation.tuitionFee.finalAmount
        .sub(paidAmount)
        .add(existingBatchAmount);
      const expectedAmount =
        requested === undefined
          ? remainingAmount
          : new Prisma.Decimal(requested);
      return expectedAmount.equals(allocation.amount);
    });
  const requestedCashDate =
    data.paymentMethod === "CASH"
      ? parsePaymentDate(data.paymentDate)
      : undefined;
  const samePaymentDate =
    data.paymentMethod !== "CASH" ||
    (requestedCashDate !== undefined &&
      existing.paymentDate.getTime() === requestedCashDate.getTime());
  const reconciliationMetadataChanged =
    existing.status === PaymentBatchStatus.SUCCESS &&
    existing.paymentMethod === "BANK_TRANSFER";
  const sameRequest =
    existing.paymentMethod === data.paymentMethod &&
    (data.paymentMethod === "CASH"
      ? existing.bankAccountId === null
      : existing.bankAccountId === data.bankAccountId) &&
    (reconciliationMetadataChanged ||
      (sameNullableText(
        existing.transactionReference,
        data.transactionReference,
      ) &&
        sameNullableText(existing.paymentContent, data.note))) &&
    sameNullableText(existing.payerName, data.payerName) &&
    sameFees &&
    sameAmounts &&
    samePaymentDate;
  if (!sameRequest) {
    throw new ConflictError(
      "Idempotency-Key đã được dùng cho request thanh toán khác",
      "IDEMPOTENCY_CONFLICT",
    );
  }
  return existing;
}

export async function completePaymentBatch(
  tx: Prisma.TransactionClient,
  batchId: string,
  actorId: string,
  data?: {
    paymentDate?: Date;
    bankAccountId?: string;
    bankTransactionNo?: string;
    transactionReference?: string;
    paymentContent?: string;
  },
  auditContext?: AuditContext,
) {
  // Serialize completion of the same batch before creating payments/receipts.
  await tx.$executeRaw(
    Prisma.sql`SELECT id FROM payment_batches WHERE id = ${batchId}::uuid FOR UPDATE`,
  );
  const batch = await tx.paymentBatch.findUnique({
    where: { id: batchId },
    include: {
      allocations: {
        include: {
          tuitionFee: {
            include: {
              class: true,
              items: {
                include: { classSubject: { include: { subject: true } } },
              },
            },
          },
        },
      },
      student: true,
    },
  });
  if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");

  if (batch.status === PaymentBatchStatus.SUCCESS) return batch;
  if (batch.status !== PaymentBatchStatus.PENDING)
    throw new ConflictError("Đợt thanh toán không còn chờ xử lý");

  if (!batch.allocations.length)
    throw new ConflictError("Đợt thanh toán không có khoản học phí");

  const allocationTotal = batch.allocations.reduce(
    (total, allocation) => total.add(allocation.amount),
    new Prisma.Decimal(0),
  );
  if (!allocationTotal.equals(batch.totalAmount))
    throw new ConflictError(
      "Tổng phân bổ không khớp tổng thanh toán",
      "AMOUNT_MISMATCH",
    );

  const teacherIds = [
    ...new Set(
      batch.allocations.flatMap((allocation) =>
        allocation.tuitionFee.items
          .map((item) => item.classSubject?.teacherId)
          .filter((teacherId): teacherId is string => Boolean(teacherId)),
      ),
    ),
  ].sort();
  for (const teacherId of teacherIds) {
    // Keep teacher identity/commission updates serialized with payment
    // completion so report data cannot change mid-transaction.
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM teachers WHERE id = ${teacherId}::uuid FOR UPDATE`,
    );
  }

  for (const allocation of batch.allocations) {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM tuition_fees WHERE id = ${allocation.tuitionFeeId}::uuid FOR UPDATE`,
    );
    const fee = await tx.tuitionFee.findUnique({
      where: { id: allocation.tuitionFeeId },
      include: {
        payments: {
          where: { paymentStatus: TuitionPaymentStatus.SUCCESS },
          select: { id: true, amount: true },
        },
      },
    });
    if (!fee) throw new NotFoundError("Không tìm thấy khoản học phí");
    const paidAmount = sumSuccessfulPayments(fee.payments);
    const remainingAmount = fee.finalAmount.sub(paidAmount);
    if (!remainingAmount.greaterThan(0))
      throw new ConflictError(
        "Học phí đã được thanh toán đủ",
        "TUITION_ALREADY_PAID",
      );
    if (
      fee.status !== TuitionFeeStatus.UNPAID &&
      fee.status !== PARTIAL_FEE_STATUS &&
      fee.status !== TuitionFeeStatus.OVERDUE
    )
      throw new ConflictError(
        `Học phí ${fee.feeNo} không còn đủ điều kiện thanh toán`,
        fee.status === TuitionFeeStatus.CANCELLED
          ? "TUITION_CANCELLED"
          : fee.status === TuitionFeeStatus.EXEMPTED
            ? "TUITION_EXEMPTED"
            : undefined,
      );
    if (!allocation.amount.greaterThan(0))
      throw new ConflictError(
        "Số tiền thanh toán phải lớn hơn 0",
        "PAYMENT_AMOUNT_MISMATCH",
      );
    if (allocation.amount.greaterThan(remainingAmount))
      throw new ConflictError(
        `Số tiền phân bổ của ${fee.feeNo} vượt số tiền còn nợ`,
        "PAYMENT_AMOUNT_MISMATCH",
      );
  }
  const paymentReceiptIssuedAt = new Date();
  const paymentDate = data?.paymentDate || batch.paymentDate;
  const bankAccountId = data?.bankAccountId ?? batch.bankAccountId;
  const bankTransactionNo =
    data?.bankTransactionNo?.trim() || batch.bankTransactionNo?.trim() || null;
  const transactionReference =
    data?.transactionReference?.trim() ||
    batch.transactionReference?.trim() ||
    null;
  if (batch.paymentMethod === "BANK_TRANSFER" && !bankAccountId) {
    throw new ConflictError(
      "Thanh toán chuyển khoản phải có tài khoản nhận tiền",
    );
  }
  if (
    batch.paymentMethod === "BANK_TRANSFER" &&
    !bankTransactionNo &&
    !transactionReference
  ) {
    throw new ConflictError(
      "Thanh toán chuyển khoản phải có mã giao dịch hoặc mã tham chiếu",
    );
  }
  if (
    batch.paymentMethod === "BANK_TRANSFER" &&
    data?.bankAccountId &&
    batch.bankAccountId &&
    data.bankAccountId !== batch.bankAccountId
  ) {
    throw new ConflictError(
      "Tài khoản ngân hàng không khớp với đợt thanh toán",
    );
  }
  if (
    batch.paymentMethod === "CASH" &&
    (bankAccountId ||
      batch.bankTransactionNo ||
      batch.transactionReference ||
      data?.bankAccountId ||
      data?.bankTransactionNo)
  ) {
    throw new ConflictError(
      "Thanh toán tiền mặt không được chứa thông tin giao dịch ngân hàng",
    );
  }
  for (const [index, allocation] of batch.allocations.entries()) {
    const sequence = String(index + 1).padStart(3, "0");
    const batchToken = batch.batchNo.slice(-20);
    const payment = await tx.tuitionPayment.create({
      data: {
        paymentNo: `PAY-${batchToken}-${sequence}`,
        tuitionFeeId: allocation.tuitionFeeId,
        studentId: batch.studentId,
        paymentBatchId: batch.id,
        paymentDate,
        amount: allocation.amount,
        paymentMethod: batch.paymentMethod,
        paymentStatus: TuitionPaymentStatus.SUCCESS,
        bankAccountId,
        bankTransactionNo:
          batch.paymentMethod === "CASH" ? undefined : bankTransactionNo,
        transactionReference:
          batch.paymentMethod === "CASH" ? undefined : transactionReference,
        payerName: batch.payerName,
        paymentContent: data?.paymentContent || batch.paymentContent,
        receivedBy: actorId,
        confirmedBy: actorId,
        confirmedAt: new Date(),
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
    const receipt = await tx.tuitionReceipt.create({
      data: {
        receiptNo: `REC-${batchToken}-${sequence}`,
        paymentId: payment.id,
        issuedBy: actorId,
        receiverName: batch.payerName?.trim() || batch.student.fullName,
        amount: allocation.amount,
        amountInWords: vietnameseAmountInWords(allocation.amount.toString()),
      },
    });
    await saveTuitionReceiptSnapshot(tx, receipt.id, {
      version: 1,
      receiptNo: receipt.receiptNo,
      issuedAt: paymentReceiptIssuedAt.toISOString(),
      student: { code: batch.student.code, fullName: batch.student.fullName },
      receiverName: batch.payerName?.trim() || batch.student.fullName,
      tuitionFee: toFeeSnapshot(allocation.tuitionFee, allocation.amount),
      amount: allocation.amount.toString(),
      paymentMethod: batch.paymentMethod,
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "TUITION_RECEIPT",
        entityId: receipt.id,
        action: "CREATED",
        dataAfter: {
          receiptNo: receipt.receiptNo,
          paymentId: payment.id,
          paymentBatchId: batch.id,
          amount: receipt.amount.toString(),
        },
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
    const successfulPayments = await tx.tuitionPayment.findMany({
      where: {
        tuitionFeeId: allocation.tuitionFeeId,
        paymentStatus: TuitionPaymentStatus.SUCCESS,
      },
      select: { amount: true },
    });
    const paidAmount = sumSuccessfulPayments(successfulPayments);
    const nextStatus = getStoredTuitionFeeStatus(
      allocation.tuitionFee.finalAmount,
      paidAmount,
    );
    await tx.tuitionFee.update({
      where: { id: allocation.tuitionFeeId },
      data: {
        status: nextStatus,
        version: { increment: 1 },
        updatedBy: actorId,
      },
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "TUITION_PAYMENT",
        entityId: payment.id,
        action: "SUCCESS",
        dataAfter: {
          paymentId: payment.id,
          tuitionFeeId: allocation.tuitionFeeId,
          amount: allocation.amount.toString(),
          receiptId: receipt.id,
          paymentBatchId: batch.id,
        },
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "TUITION_FEE",
        entityId: allocation.tuitionFeeId,
        action: nextStatus === TuitionFeeStatus.PAID ? "PAID" : "PARTIAL",
        dataAfter: {
          paymentId: payment.id,
          paymentBatchId: batch.id,
          status: nextStatus,
        },
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
  }
  const batchReceipt = await tx.paymentBatchReceipt.create({
    data: {
      receiptNo: `BRC-${batch.batchNo}`.slice(0, 40),
      paymentBatchId: batch.id,
      issuedBy: actorId,
      receiverName: batch.payerName?.trim() || batch.student.fullName,
      amount: batch.totalAmount,
    },
  });
  await savePaymentBatchReceiptSnapshot(tx, batchReceipt.id, {
    version: 1,
    receiptNo: batchReceipt.receiptNo,
    issuedAt: paymentReceiptIssuedAt.toISOString(),
    student: { code: batch.student.code, fullName: batch.student.fullName },
    receiverName: batch.payerName?.trim() || batch.student.fullName,
    fees: batch.allocations.map((allocation) =>
      toFeeSnapshot(allocation.tuitionFee, allocation.amount),
    ),
    amount: batch.totalAmount.toString(),
    paymentMethod: batch.paymentMethod,
  });
  await tx.tuitionAuditLog.create({
    data: {
      entityType: "PAYMENT_BATCH_RECEIPT",
      entityId: batchReceipt.id,
      action: "CREATED",
      dataAfter: {
        receiptNo: batchReceipt.receiptNo,
        paymentBatchId: batch.id,
        amount: batchReceipt.amount.toString(),
      },
      performedBy: actorId,
      ...auditFields(auditContext),
    },
  });
  const completed = await tx.paymentBatch.update({
    where: { id: batch.id },
    data: {
      status: PaymentBatchStatus.SUCCESS,
      paymentDate,
      bankAccountId,
      bankTransactionNo:
        batch.paymentMethod === "CASH" ? null : bankTransactionNo,
      transactionReference:
        batch.paymentMethod === "CASH" ? null : transactionReference,
      paymentContent: data?.paymentContent || batch.paymentContent,
      confirmedBy: actorId,
      confirmedAt: new Date(),
      updatedBy: actorId,
    },
    include: { allocations: true, receipt: true },
  });
  await tx.tuitionAuditLog.create({
    data: {
      entityType: "PAYMENT_BATCH",
      entityId: batch.id,
      action: "SUCCESS",
      dataBefore: { status: batch.status },
      dataAfter: {
        status: completed.status,
        paymentDate: completed.paymentDate.toISOString(),
        totalAmount: completed.totalAmount.toString(),
        allocationCount: completed.allocations.length,
      },
      performedBy: actorId,
      ...auditFields(auditContext),
    },
  });
  return completed;
}

export async function createPaymentBatch(
  data: PaymentBatchCreate,
  actorId: string,
  transaction?: Prisma.TransactionClient,
  auditContext?: AuditContext,
) {
  const execute = async (tx: Prisma.TransactionClient) => {
    const existingIdempotentBatch = await findIdempotentBatch(tx, data);
    if (existingIdempotentBatch) return existingIdempotentBatch;
    if (data.paymentMethod === "CASH" && !data.paymentDate) {
      throw new ConflictError("Ngày nhận tiền mặt là bắt buộc");
    }
    if (data.paymentMethod === "BANK_TRANSFER" && data.paymentDate) {
      throw new ConflictError(
        "Ngày chuyển khoản được lấy từ sao kê khi đối soát",
      );
    }
    const requestedPaymentDate = parsePaymentDate(data.paymentDate);
    const feeRefs = await tx.tuitionFee.findMany({
      where: { id: { in: data.tuitionFeeIds } },
      select: { id: true, studentId: true },
    });
    if (feeRefs.length !== data.tuitionFeeIds.length)
      throw new NotFoundError("Không tìm thấy đầy đủ các khoản học phí");
    const studentId = feeRefs[0]?.studentId;
    if (!studentId || feeRefs.some((fee) => fee.studentId !== studentId))
      throw new ConflictError("Chỉ được gom học phí của cùng một học viên");
    if (data.paymentMethod === "CASH" && data.bankAccountId)
      throw new ConflictError(
        "Thanh toán tiền mặt không được gắn tài khoản ngân hàng",
      );
    if (data.paymentMethod === "CASH" && data.transactionReference)
      throw new ConflictError(
        "Thanh toán tiền mặt không được có mã giao dịch ngân hàng",
      );
    if (data.paymentMethod === "BANK_TRANSFER" && !data.bankAccountId)
      throw new ConflictError(
        "Thanh toán chuyển khoản phải có tài khoản nhận tiền",
      );
    let bankAccountSnapshot: DocumentSnapshot["bankAccount"];
    if (data.bankAccountId) {
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM bank_accounts WHERE id = ${data.bankAccountId}::uuid FOR UPDATE`,
      );
      const bankAccount = await tx.bankAccount.findUnique({
        where: { id: data.bankAccountId },
        select: {
          id: true,
          isActive: true,
          bankCode: true,
          bankName: true,
          accountNo: true,
          accountName: true,
        },
      });
      if (!bankAccount || !bankAccount.isActive)
        throw new ConflictError("Tài khoản ngân hàng không hoạt động");
      bankAccountSnapshot = {
        bankCode: bankAccount.bankCode,
        bankName: bankAccount.bankName,
        accountNo: bankAccount.accountNo,
        accountName: bankAccount.accountName,
      };
    }
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${studentId}))`,
    );

    // Serialize fee edits and payment completion before reading amounts/statuses.
    await lockTuitionFeeRows(tx, data.tuitionFeeIds);

    const fees = await tx.tuitionFee.findMany({
      where: { id: { in: data.tuitionFeeIds } },
      include: {
        student: true,
        class: true,
        items: { include: { classSubject: { include: { subject: true } } } },
      },
    });
    if (fees.length !== data.tuitionFeeIds.length)
      throw new NotFoundError("Không tìm thấy đầy đủ các khoản học phí");
    if (fees.some((fee) => fee.studentId !== studentId))
      throw new ConflictError("Chỉ được gom học phí của cùng một học viên");
    if (
      fees.some(
        (fee) =>
          fee.status !== TuitionFeeStatus.UNPAID &&
          fee.status !== PARTIAL_FEE_STATUS &&
          fee.status !== TuitionFeeStatus.OVERDUE,
      )
    )
      throw new ConflictError(
        "Danh sách có học phí không còn đủ điều kiện thanh toán",
        fees.some((fee) => fee.status === TuitionFeeStatus.CANCELLED)
          ? "TUITION_CANCELLED"
          : fees.some((fee) => fee.status === TuitionFeeStatus.EXEMPTED)
            ? "TUITION_EXEMPTED"
            : undefined,
      );
    if (fees.some((fee) => !fee.finalAmount.greaterThan(0)))
      throw new ConflictError("Học phí phải có số tiền lớn hơn 0");
    const paid = await tx.tuitionPayment.findMany({
      where: {
        tuitionFeeId: { in: data.tuitionFeeIds },
        paymentStatus: TuitionPaymentStatus.SUCCESS,
      },
      select: { tuitionFeeId: true, amount: true },
    });
    const paidByFee = new Map<string, Prisma.Decimal>();
    for (const payment of paid) {
      paidByFee.set(
        payment.tuitionFeeId,
        (paidByFee.get(payment.tuitionFeeId) ?? new Prisma.Decimal(0)).add(
          payment.amount,
        ),
      );
    }
    const requestedAmounts = new Map<string, Prisma.Decimal>();
    for (const fee of fees) {
      const paidAmount = paidByFee.get(fee.id) ?? new Prisma.Decimal(0);
      const remainingAmount = fee.finalAmount.sub(paidAmount);
      if (!remainingAmount.greaterThan(0))
        throw new ConflictError(
          `Học phí ${fee.feeNo} đã được thanh toán đủ`,
          "TUITION_ALREADY_PAID",
        );
      const rawAmount = data.amounts?.[fee.id];
      const amount =
        rawAmount === undefined
          ? remainingAmount
          : new Prisma.Decimal(rawAmount);
      if (!amount.greaterThan(0) || amount.greaterThan(remainingAmount))
        throw new ConflictError(
          `Số tiền thanh toán của ${fee.feeNo} vượt số tiền còn nợ`,
          "PAYMENT_AMOUNT_MISMATCH",
        );
      requestedAmounts.set(fee.id, amount);
    }
    const totalAmount = [...requestedAmounts.values()].reduce(
      (sum, amount) => sum.add(amount),
      new Prisma.Decimal(0),
    );
    const selectedFeeIds = new Set(data.tuitionFeeIds);
    const pendingBatches = await tx.paymentBatch.findMany({
      where: { studentId, status: PaymentBatchStatus.PENDING },
      include: { allocations: true, receipt: true },
    });
    const duplicate = pendingBatches.find(
      (candidate) =>
        candidate.allocations.length === selectedFeeIds.size &&
        candidate.allocations.every((allocation) =>
          selectedFeeIds.has(allocation.tuitionFeeId),
        ),
    );
    if (duplicate) {
      const samePaymentMethod = duplicate.paymentMethod === data.paymentMethod;
      const sameBankAccount =
        data.paymentMethod === "BANK_TRANSFER"
          ? duplicate.bankAccountId === data.bankAccountId
          : duplicate.bankAccountId === null;
      const sameAmounts = duplicate.allocations.every((allocation) => {
        const expectedAmount = requestedAmounts.get(allocation.tuitionFeeId);
        if (!expectedAmount) return false;
        return allocation.amount.equals(expectedAmount);
      });
      if (!samePaymentMethod || !sameBankAccount || !sameAmounts) {
        throw new ConflictError(
          `Các khoản học phí đã thuộc đợt ${duplicate.batchNo} với thông tin thanh toán khác`,
        );
      }
      return duplicate;
    }
    if (
      pendingBatches.some((candidate) =>
        candidate.allocations.some((allocation) =>
          selectedFeeIds.has(allocation.tuitionFeeId),
        ),
      )
    )
      throw new ConflictError(
        "Một hoặc nhiều học phí đang thuộc đợt thanh toán chờ đối soát",
      );
    const batch = await tx.paymentBatch.create({
      data: {
        batchNo: await generateBatchNo(tx),
        studentId,
        totalAmount,
        paymentMethod: data.paymentMethod,
        status: PaymentBatchStatus.PENDING,
        paymentDate: requestedPaymentDate,
        bankAccountId:
          data.paymentMethod === "BANK_TRANSFER"
            ? data.bankAccountId
            : undefined,
        transactionReference: data.transactionReference,
        payerName: data.payerName,
        paymentContent: data.note,
        createdBy: actorId,
        updatedBy: actorId,
        allocations: {
          create: fees.map((fee) => ({
            tuitionFeeId: fee.id,
            amount: requestedAmounts.get(fee.id)!,
          })),
        },
      },
      include: {
        allocations: { include: { tuitionFee: true } },
        student: true,
      },
    });
    if (data.idempotencyKey) {
      await tx.$executeRaw(
        Prisma.sql`UPDATE payment_batches SET idempotency_key = ${data.idempotencyKey} WHERE id = ${batch.id}::uuid`,
      );
    }
    if (data.paymentMethod === "BANK_TRANSFER") {
      await savePaymentBatchNoticeSnapshot(tx, batch.id, {
        version: 1,
        student: {
          code: fees[0]!.student.code,
          fullName: fees[0]!.student.fullName,
        },
        fees: fees.map((fee) =>
          toFeeSnapshot(fee, requestedAmounts.get(fee.id)),
        ),
        ...(bankAccountSnapshot ? { bankAccount: bankAccountSnapshot } : {}),
      });
    }
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "PAYMENT_BATCH",
        entityId: batch.id,
        action: "CREATED",
        dataAfter: {
          status: batch.status,
          paymentMethod: batch.paymentMethod,
          totalAmount: batch.totalAmount.toString(),
          tuitionFeeIds: data.tuitionFeeIds,
        },
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
    if (data.paymentMethod === "CASH")
      return completePaymentBatch(
        tx,
        batch.id,
        actorId,
        {
          paymentDate: requestedPaymentDate,
        },
        auditContext,
      );
    return batch;
  };
  return transaction ? execute(transaction) : prisma.$transaction(execute);
}

export async function createNoticeBatches(
  data: NoticeBatchCreate,
  actorId: string,
  auditContext?: AuditContext,
) {
  return prisma.$transaction(
    async (tx) => {
      const feeRefs = await tx.tuitionFee.findMany({
        where: { id: { in: data.tuitionFeeIds } },
        select: { id: true, studentId: true },
        orderBy: [{ studentId: "asc" }, { id: "asc" }],
      });
      if (feeRefs.length !== data.tuitionFeeIds.length) {
        throw new NotFoundError("Không tìm thấy đầy đủ các khoản học phí");
      }

      const studentIds = new Set(feeRefs.map((fee) => fee.studentId));
      if (data.mode === "GROUPED" && studentIds.size !== 1) {
        throw new ConflictError("Chỉ được gộp học phí của cùng một học sinh");
      }

      const groups =
        data.mode === "GROUPED"
          ? [feeRefs]
          : data.mode === "BY_STUDENT"
            ? [
                ...feeRefs
                  .reduce((byStudent, fee) => {
                    const group = byStudent.get(fee.studentId) ?? [];
                    group.push(fee);
                    byStudent.set(fee.studentId, group);
                    return byStudent;
                  }, new Map<string, typeof feeRefs>())
                  .values(),
              ]
            : feeRefs.map((fee) => [fee]);
      const batches = [];
      for (const [index, group] of groups.entries()) {
        const batch = await createPaymentBatch(
          {
            tuitionFeeIds: group.map((fee) => fee.id),
            paymentMethod: "BANK_TRANSFER",
            bankAccountId: data.bankAccountId,
            idempotencyKey: `${data.idempotencyKey}-${index + 1}`.slice(0, 150),
          },
          actorId,
          tx,
          auditContext,
        );
        batches.push(batch);
      }

      return {
        batches: batches.map((batch) => ({
          id: batch.id,
          batchNo: batch.batchNo,
          totalAmount: batch.totalAmount,
        })),
      };
    },
    { timeout: 30_000 },
  );
}

export async function createClassNoticeBatches(
  data: ClassNoticeBatchCreate,
  actorId: string,
  auditContext?: AuditContext,
) {
  const year = Number(data.month.slice(0, 4));
  const month = Number(data.month.slice(5, 7));
  const keyPrefix = `class-${createHash("sha256").update(data.idempotencyKey).digest("hex").slice(0, 32)}-`;

  return prisma.$transaction(
    async (tx) => {
      const targetFees = await tx.tuitionFee.findMany({
        where: {
          classId: data.classId,
          billingType: "MONTHLY",
          billingYear: year,
          billingMonth: month,
          status: {
            in: [
              TuitionFeeStatus.UNPAID,
              PARTIAL_FEE_STATUS,
              TuitionFeeStatus.OVERDUE,
            ],
          },
        },
        select: { id: true, studentId: true },
        orderBy: { id: "asc" },
      });
      if (!targetFees.length) {
        throw new ConflictError(
          "Lớp và kỳ đã chọn không có khoản học phí còn nợ",
        );
      }
      const targetFeeIds = targetFees.map((fee) => fee.id);
      const expectedIdempotencyKeys = [...new Set(targetFees.map((fee) => fee.studentId))]
        .map((studentId) => `${keyPrefix}${studentId}`);
      const priorBatches = await tx.paymentBatch.findMany({
        where: { idempotencyKey: { in: expectedIdempotencyKeys } },
        orderBy: { createdAt: "asc" },
      });
      if (priorBatches.length) {
        if (
          priorBatches.length !== expectedIdempotencyKeys.length ||
          priorBatches.some((batch) => batch.status !== PaymentBatchStatus.PENDING)
        ) {
          throw new ConflictError(
            "Lần phát hành theo lớp này đã được xử lý trước đó",
          );
        }
        return {
          batches: priorBatches.map((batch) => ({
            id: batch.id,
            batchNo: batch.batchNo,
            totalAmount: batch.totalAmount,
          })),
          replacedBatchCount: 0,
        };
      }
      const initialPendingBatches = await tx.paymentBatch.findMany({
        where: {
          status: PaymentBatchStatus.PENDING,
          allocations: { some: { tuitionFeeId: { in: targetFeeIds } } },
        },
        select: { id: true, studentId: true },
      });
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM bank_accounts WHERE id = ${data.bankAccountId}::uuid FOR UPDATE`,
      );
      const bankAccount = await tx.bankAccount.findUnique({
        where: { id: data.bankAccountId },
        select: {
          isActive: true,
          bankCode: true,
          bankName: true,
          accountNo: true,
          accountName: true,
        },
      });
      if (!bankAccount || !bankAccount.isActive) {
        throw new ConflictError("Tài khoản ngân hàng không hoạt động");
      }
      const bankAccountSnapshot = {
        bankCode: bankAccount.bankCode,
        bankName: bankAccount.bankName,
        accountNo: bankAccount.accountNo,
        accountName: bankAccount.accountName,
      };
      await lockStudentRows(tx, [
        ...targetFees.map((fee) => fee.studentId),
        ...initialPendingBatches.map((batch) => batch.studentId),
      ]);
      const pendingBatches = await tx.paymentBatch.findMany({
        where: {
          status: PaymentBatchStatus.PENDING,
          allocations: { some: { tuitionFeeId: { in: targetFeeIds } } },
        },
        include: { allocations: true },
        orderBy: { id: "asc" },
      });
      await lockPaymentBatchRows(
        tx,
        pendingBatches.map((batch) => batch.id),
      );
      const affectedFeeIds = [
        ...new Set([
          ...targetFeeIds,
          ...pendingBatches.flatMap((batch) =>
            batch.allocations.map((allocation) => allocation.tuitionFeeId),
          ),
        ]),
      ].sort();
      await lockTuitionFeeRows(tx, affectedFeeIds);

      const eligibleFees = await tx.tuitionFee.findMany({
        where: { id: { in: affectedFeeIds } },
        include: {
          student: true,
          class: true,
          items: { include: { classSubject: { include: { subject: true } } } },
          payments: {
            where: { paymentStatus: TuitionPaymentStatus.SUCCESS },
            select: { amount: true },
          },
        },
      });
      const feeById = new Map(eligibleFees.map((fee) => [fee.id, fee]));
      const chargeableStatuses = new Set<TuitionFeeStatus>([
        TuitionFeeStatus.UNPAID,
        PARTIAL_FEE_STATUS,
        TuitionFeeStatus.OVERDUE,
      ]);
      const outstanding = affectedFeeIds.flatMap((id) => {
        const fee = feeById.get(id);
        if (!fee || !chargeableStatuses.has(fee.status)) return [];
        const remaining = fee.finalAmount.sub(
          sumSuccessfulPayments(fee.payments),
        );
        return remaining.greaterThan(0) ? [fee] : [];
      });
      if (!outstanding.length) {
        throw new ConflictError(
          "Các khoản học phí đã được thanh toán hoặc không còn đủ điều kiện phát hành",
        );
      }

      const cancellationReason = `Thay thế khi phát hành thông báo theo lớp cho kỳ ${data.month}`;
      if (pendingBatches.length) {
        const cancelled = await tx.paymentBatch.updateMany({
          where: {
            id: { in: pendingBatches.map((batch) => batch.id) },
            status: PaymentBatchStatus.PENDING,
          },
          data: {
            status: PaymentBatchStatus.CANCELLED,
            updatedBy: actorId,
          },
        });
        if (cancelled.count !== pendingBatches.length) {
          throw new ConflictError("Có đợt thu vừa được xử lý; hãy tải lại và thử lại");
        }
        await tx.tuitionAuditLog.createMany({
          data: pendingBatches.map((batch) => ({
            entityType: "PAYMENT_BATCH",
            entityId: batch.id,
            action: "CANCEL",
            reason: cancellationReason,
            dataBefore: {
              status: PaymentBatchStatus.PENDING,
              paymentMethod: batch.paymentMethod,
              totalAmount: batch.totalAmount.toString(),
              allocations: batch.allocations.map((allocation) => ({
                tuitionFeeId: allocation.tuitionFeeId,
                amount: allocation.amount.toString(),
              })),
            },
            dataAfter: {
              status: PaymentBatchStatus.CANCELLED,
              updatedBy: actorId,
              paymentMethod: batch.paymentMethod,
              totalAmount: batch.totalAmount.toString(),
            },
            performedBy: actorId,
            ...auditFields(auditContext),
          })),
        });
      }

      const grouped = new Map<string, typeof outstanding>();
      for (const fee of outstanding) {
        const group = grouped.get(fee.studentId) ?? [];
        group.push(fee);
        grouped.set(fee.studentId, group);
      }
      const groups = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
      const batchNos = await generateBatchNumbers(tx, groups.length);
      const now = new Date();
      const newBatches = groups.map(([studentId, fees], index) => {
        const payableAmounts = fees.map((fee) =>
          fee.finalAmount.sub(sumSuccessfulPayments(fee.payments)),
        );
        const totalAmount = payableAmounts.reduce(
          (sum, amount) => sum.add(amount),
          new Prisma.Decimal(0),
        );
        const snapshot: DocumentSnapshot = {
          version: 1,
          student: {
            code: fees[0]!.student.code,
            fullName: fees[0]!.student.fullName,
          },
          fees: fees.map((fee, feeIndex) =>
            toFeeSnapshot(fee, payableAmounts[feeIndex]),
          ),
          bankAccount: bankAccountSnapshot,
        };
        return {
          id: randomUUID(),
          batchNo: batchNos[index]!,
          studentId,
          fees,
          payableAmounts,
          totalAmount,
          idempotencyKey: `${keyPrefix}${studentId}`,
          snapshot,
        };
      });
      await tx.paymentBatch.createMany({
        data: newBatches.map((batch) => ({
          id: batch.id,
          batchNo: batch.batchNo,
          studentId: batch.studentId,
          totalAmount: batch.totalAmount,
          paymentMethod: "BANK_TRANSFER",
          status: PaymentBatchStatus.PENDING,
          bankAccountId: data.bankAccountId,
          idempotencyKey: batch.idempotencyKey,
          noticeSnapshot: batch.snapshot as unknown as Prisma.InputJsonValue,
          createdBy: actorId,
          updatedBy: actorId,
          createdAt: now,
          updatedAt: now,
        })),
      });
      await tx.paymentAllocation.createMany({
        data: newBatches.flatMap((batch) =>
          batch.fees.map((fee, index) => ({
            paymentBatchId: batch.id,
            tuitionFeeId: fee.id,
            amount: batch.payableAmounts[index]!,
          })),
        ),
      });
      await tx.tuitionAuditLog.createMany({
        data: newBatches.map((batch) => ({
          entityType: "PAYMENT_BATCH",
          entityId: batch.id,
          action: "CREATED",
          dataAfter: {
            status: PaymentBatchStatus.PENDING,
            paymentMethod: "BANK_TRANSFER",
            totalAmount: batch.totalAmount.toString(),
            tuitionFeeIds: batch.fees.map((fee) => fee.id),
          },
          performedBy: actorId,
          ...auditFields(auditContext),
        })),
      });
      return {
        batches: newBatches.map((batch) => ({
          id: batch.id,
          batchNo: batch.batchNo,
          totalAmount: batch.totalAmount,
        })),
        replacedBatchCount: pendingBatches.length,
      };
    },
    { timeout: 60_000 },
  );
}

async function cancelPendingBatchInTransaction(
  tx: Prisma.TransactionClient,
  batchId: string,
  actorId: string,
  reason: string,
  auditContext?: AuditContext,
) {
  await tx.$executeRaw(
    Prisma.sql`SELECT id FROM payment_batches WHERE id = ${batchId}::uuid FOR UPDATE`,
  );
  const batch = await tx.paymentBatch.findUnique({
    where: { id: batchId },
    include: { allocations: true },
  });
  if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");
  if (batch.status !== PaymentBatchStatus.PENDING) {
    throw new ConflictError(
      "Chỉ có thể thay đổi đợt thanh toán đang chờ đối soát",
    );
  }

  const cancelled = await tx.paymentBatch.update({
    where: { id: batchId },
    data: { status: PaymentBatchStatus.CANCELLED, updatedBy: actorId },
    include: { allocations: true, student: true },
  });
  await tx.tuitionAuditLog.create({
    data: {
      entityType: "PAYMENT_BATCH",
      entityId: batchId,
      action: "CANCEL",
      reason,
      dataBefore: batch as unknown as Prisma.InputJsonValue,
      dataAfter: cancelled as unknown as Prisma.InputJsonValue,
      performedBy: actorId,
      ...auditFields(auditContext),
    },
  });
  return { batch, cancelled };
}

export async function restructurePendingBatches(
  data: PendingBatchRestructure,
  actorId: string,
  auditContext?: AuditContext,
) {
  return prisma.$transaction(async (tx) => {
    const batchIds =
      data.operation === "SPLIT"
        ? [data.sourceBatchId]
        : [...new Set(data.batchIds)];
    const sourceBatches = await tx.paymentBatch.findMany({
      where: { id: { in: batchIds } },
      include: { allocations: true },
    });
    if (sourceBatches.length !== batchIds.length) {
      throw new NotFoundError("Không tìm thấy đầy đủ các đợt thanh toán");
    }
    if (
      sourceBatches.some((batch) => batch.status !== PaymentBatchStatus.PENDING)
    ) {
      throw new ConflictError("Chỉ có thể tách hoặc gộp đợt đang chờ đối soát");
    }
    if (
      sourceBatches.some((batch) => batch.paymentMethod !== "BANK_TRANSFER")
    ) {
      throw new ConflictError("Chỉ có thể tách hoặc gộp đợt chuyển khoản");
    }
    if (new Set(sourceBatches.map((batch) => batch.studentId)).size !== 1) {
      throw new ConflictError(
        "Chỉ được tách hoặc gộp các đợt của cùng một học sinh",
      );
    }
    if (new Set(sourceBatches.map((batch) => batch.bankAccountId)).size !== 1) {
      throw new ConflictError("Các đợt phải dùng cùng một tài khoản nhận tiền");
    }

    const allocations = sourceBatches.flatMap((batch) => batch.allocations);
    if (data.operation === "SPLIT" && allocations.length < 2) {
      throw new ConflictError(
        "Đợt thanh toán chỉ có một khoản, không cần tách",
      );
    }

    const groups =
      data.operation === "SPLIT"
        ? allocations.map((allocation) => [allocation])
        : [allocations];
    for (const batch of sourceBatches) {
      await cancelPendingBatchInTransaction(
        tx,
        batch.id,
        actorId,
        data.reason,
        auditContext,
      );
    }

    const newBatches = [];
    for (const [index, group] of groups.entries()) {
      const created = await createPaymentBatch(
        {
          tuitionFeeIds: group.map((allocation) => allocation.tuitionFeeId),
          amounts: Object.fromEntries(
            group.map((allocation) => [
              allocation.tuitionFeeId,
              allocation.amount.toString(),
            ]),
          ),
          paymentMethod: "BANK_TRANSFER",
          bankAccountId: sourceBatches[0]?.bankAccountId ?? undefined,
          idempotencyKey: `${data.idempotencyKey}-${index + 1}`.slice(0, 150),
        },
        actorId,
        tx,
        auditContext,
      );
      newBatches.push(created);
    }

    for (const oldBatch of sourceBatches) {
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "PAYMENT_BATCH",
          entityId: oldBatch.id,
          action: data.operation,
          reason: data.reason,
          dataBefore: {
            batchNo: oldBatch.batchNo,
            allocationCount: oldBatch.allocations.length,
          },
          dataAfter: {
            batchIds: newBatches.map((batch) => batch.id),
            batchNos: newBatches.map((batch) => batch.batchNo),
          },
          performedBy: actorId,
          ...auditFields(auditContext),
        },
      });
    }

    return {
      batches: newBatches.map((batch) => ({
        id: batch.id,
        batchNo: batch.batchNo,
        totalAmount: batch.totalAmount,
      })),
    };
  });
}

export async function listPaymentBatches(params: {
  transactionCode?: string;
  studentCode?: string;
  studentId?: string;
  search?: string;
  classId?: string;
  billingYear?: number;
  billingMonth?: number;
  status?: PaymentBatchStatus;
  page: number;
  pageSize: number;
}) {
  const page = Number.isFinite(params.page)
    ? Math.max(Math.floor(params.page), 1)
    : 1;
  const pageSize = Number.isFinite(params.pageSize)
    ? Math.min(Math.max(Math.floor(params.pageSize), 1), 100)
    : 20;
  const transactionSearchValues = params.transactionCode
    ? (() => {
        const values = [params.transactionCode];
        const batchMatch = params.transactionCode.match(
          /PB(?:[\s_-]*PB)?[\s_-]*(\d{8})[\s_-]*(\d{6})/i,
        );
        if (batchMatch) {
          values.push(`PB-${batchMatch[1]}-${batchMatch[2]}`);
          values.push(`PB${batchMatch[1]}${batchMatch[2]}`);
        }
        return values.filter(
          (value, index, allValues) => allValues.indexOf(value) === index,
        );
      })()
    : [];
  const search = params.search?.trim();
  const filters: Prisma.PaymentBatchWhereInput[] = [];
  if (transactionSearchValues.length) {
    filters.push({
      OR: transactionSearchValues.flatMap((value) => [
        { batchNo: { contains: value, mode: "insensitive" as const } },
        {
          bankTransactionNo: { contains: value, mode: "insensitive" as const },
        },
        {
          transactionReference: {
            contains: value,
            mode: "insensitive" as const,
          },
        },
      ]),
    });
  }
  if (search) {
    filters.push({
      OR: [
        { batchNo: { contains: search, mode: "insensitive" } },
        { student: { code: { contains: search, mode: "insensitive" } } },
        { student: { fullName: { contains: search, mode: "insensitive" } } },
        {
          allocations: {
            some: {
              tuitionFee: { feeNo: { contains: search, mode: "insensitive" } },
            },
          },
        },
        {
          allocations: {
            some: {
              tuitionFee: {
                class: { code: { contains: search, mode: "insensitive" } },
              },
            },
          },
        },
        {
          allocations: {
            some: {
              tuitionFee: {
                class: { name: { contains: search, mode: "insensitive" } },
              },
            },
          },
        },
      ],
    });
  }
  const where: Prisma.PaymentBatchWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.studentCode || params.studentId
      ? {
          student: {
            ...(params.studentCode
              ? {
                  code: {
                    contains: params.studentCode,
                    mode: "insensitive" as const,
                  },
                }
              : {}),
            ...(params.studentId ? { id: params.studentId } : {}),
          },
        }
      : {}),
    ...(params.classId || params.billingYear || params.billingMonth
      ? {
          allocations: {
            some: {
              tuitionFee: {
                ...(params.classId ? { classId: params.classId } : {}),
                ...(params.billingYear
                  ? { billingYear: params.billingYear }
                  : {}),
                ...(params.billingMonth
                  ? { billingMonth: params.billingMonth }
                  : {}),
              },
            },
          },
        }
      : {}),
    ...(filters.length ? { AND: filters } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.paymentBatch.findMany({
      where,
      include: {
        student: true,
        receipt: true,
        allocations: { include: { tuitionFee: { include: { class: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.paymentBatch.count({ where }),
  ]);
  return {
    items: items.map((item) => ({
      ...item,
      receipt: item.status === PaymentBatchStatus.SUCCESS ? item.receipt : null,
    })),
    total,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getPaymentBatchDetail(batchId: string) {
  const batch = await prisma.paymentBatch.findUnique({
    where: { id: batchId },
    include: {
      student: true,
      bankAccount: true,
      receipt: true,
      allocations: {
        include: {
          tuitionFee: {
            include: {
              class: true,
              items: {
                include: {
                  classSubject: { include: { subject: true } },
                },
                orderBy: { displayOrder: "asc" },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      payments: {
        include: { receipt: true },
        orderBy: { paymentDate: "asc" },
      },
    },
  });
  if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");

  const printedAtRow = batch.receipt
    ? (
        await prisma.$queryRaw<Array<{ printedAt: Date | null }>>(
          Prisma.sql`SELECT printed_at AS "printedAt"
          FROM payment_batch_receipts
          WHERE id = ${batch.receipt.id}::uuid`,
        )
      )[0]
    : null;

  const auditLogs = await prisma.tuitionAuditLog.findMany({
    where: {
      entityType: "PAYMENT_BATCH",
      entityId: batchId,
      action: "SUCCESS",
    },
    orderBy: { performedAt: "desc" },
    select: { performedBy: true },
  });

  const userIds = [
    batch.createdBy,
    batch.updatedBy,
    batch.confirmedBy,
    ...batch.payments.flatMap((payment) => [
      payment.receivedBy,
      payment.confirmedBy,
    ]),
    ...auditLogs.map((log) => log.performedBy),
  ].filter((userId): userId is string => Boolean(userId));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, fullName: true, email: true },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));

  const allocations = batch.allocations.map((allocation) => ({
    ...allocation,
    tuitionFee: {
      ...allocation.tuitionFee,
      status: getEffectiveTuitionFeeStatus(
        allocation.tuitionFee.status,
        allocation.tuitionFee.dueDate,
      ),
    },
  }));

  return {
    ...batch,
    allocations,
    receipt:
      batch.status === PaymentBatchStatus.SUCCESS && batch.receipt
        ? { ...batch.receipt, printedAt: printedAtRow?.printedAt ?? null }
        : null,
    createdByUser: usersById.get(batch.createdBy) || null,
    updatedByUser: usersById.get(batch.updatedBy) || null,
    confirmedByUser: batch.confirmedBy
      ? usersById.get(batch.confirmedBy) || null
      : null,
    receivedByUser:
      usersById.get(
        batch.payments.find((payment) => payment.receivedBy)?.receivedBy ||
          (batch.paymentMethod === "CASH"
            ? auditLogs[0]?.performedBy
            : undefined) ||
          "",
      ) || null,
  };
}

export async function cancelPaymentBatch(
  batchId: string,
  actorId: string,
  reason: string,
  auditContext?: AuditContext,
) {
  return prisma.$transaction(async (tx) => {
    return (
      await cancelPendingBatchInTransaction(
        tx,
        batchId,
        actorId,
        reason,
        auditContext,
      )
    ).cancelled;
  });
}

export async function convertPaymentBatchToCash(
  batchId: string,
  actorId: string,
  paymentDate: string,
  note: string | undefined,
  auditContext?: AuditContext,
) {
  const cashPaymentDate = parsePaymentDate(paymentDate);
  if (!cashPaymentDate)
    throw new ConflictError("Ngày nhận tiền mặt là bắt buộc");
  const cashPaymentNote = note?.trim() || "Thanh toán tiền mặt";
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM payment_batches WHERE id = ${batchId}::uuid FOR UPDATE`,
    );
    const batch = await tx.paymentBatch.findUnique({
      where: { id: batchId },
      include: { allocations: true },
    });
    if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");
    if (batch.status !== PaymentBatchStatus.PENDING)
      throw new ConflictError(
        "Chỉ có thể chuyển sang tiền mặt với đợt đang chờ xử lý",
      );
    if (batch.paymentMethod !== "BANK_TRANSFER")
      throw new ConflictError(
        "Chỉ có thể chuyển đợt thanh toán chuyển khoản sang tiền mặt",
      );

    await tx.paymentBatch.update({
      where: { id: batchId },
      data: {
        paymentMethod: "CASH",
        bankAccountId: null,
        bankTransactionNo: null,
        transactionReference: null,
        updatedBy: actorId,
      },
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "PAYMENT_BATCH",
        entityId: batchId,
        action: "UPDATE",
        dataBefore: { paymentMethod: batch.paymentMethod },
        dataAfter: {
          paymentMethod: "CASH",
          paymentContent: cashPaymentNote,
          reason: "Chuyển sang thanh toán tiền mặt",
        },
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
    return completePaymentBatch(
      tx,
      batchId,
      actorId,
      {
        paymentDate: cashPaymentDate,
        paymentContent: cashPaymentNote,
      },
      auditContext,
    );
  });
}

export async function getPaymentBatchQr(
  batchId: string,
  actorId: string,
  auditContext?: AuditContext,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM payment_batches WHERE id = ${batchId}::uuid FOR UPDATE`,
    );
    const batch = await tx.paymentBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");
    if (batch.status !== PaymentBatchStatus.PENDING)
      throw new ConflictError("Đợt thanh toán không còn hiệu lực");
    if (batch.paymentMethod !== "BANK_TRANSFER")
      throw new ConflictError("Chỉ payment batch chuyển khoản mới có mã QR");
    if (!batch.bankAccountId)
      throw new ConflictError("Đợt thanh toán chưa gắn tài khoản ngân hàng");
    const account = await tx.bankAccount.findFirst({
      where: { id: batch.bankAccountId, isActive: true },
    });
    if (!account)
      throw new ConflictError("Chưa cấu hình tài khoản ngân hàng nhận học phí");
    const qrUrl = buildVietQrUrl({
      bankCode: account.bankCode,
      accountNo: account.accountNo,
      accountName: account.accountName,
      amount: Number(batch.totalAmount),
      addInfo: `PB ${batch.batchNo}`,
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "PAYMENT_BATCH",
        entityId: batch.id,
        action: "QR_GENERATED",
        dataAfter: {
          batchNo: batch.batchNo,
          amount: batch.totalAmount.toString(),
          bankAccountId: account.id,
        },
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
    return {
      batchNo: batch.batchNo,
      amount: batch.totalAmount,
      account,
      qrUrl,
    };
  });
}
