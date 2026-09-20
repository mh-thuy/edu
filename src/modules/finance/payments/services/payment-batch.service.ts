import {
  Prisma,
  TuitionFeeStatus,
  TuitionPaymentStatus,
  PaymentBatchStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditFields, type AuditContext } from "@/lib/audit";
import type { PaymentBatchCreate } from "../schemas/payment-batch.schema";
import { parseVietnamDateStart } from "@/lib/vietnam-time";
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

function sumSuccessfulPayments(
  payments: Array<{ amount: Prisma.Decimal }>,
) {
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
          allocations: { include: { tuitionFee: true } },
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
      return (
        requested === undefined ||
        new Prisma.Decimal(requested).equals(allocation.amount)
      );
    });
  const requestedCashDate =
    data.paymentMethod === "CASH" ? parsePaymentDate(data.paymentDate) : undefined;
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
      (sameNullableText(existing.transactionReference, data.transactionReference) &&
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
              items: { include: { classSubject: { include: { subject: true } } } },
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
    throw new ConflictError("Tổng phân bổ không khớp tổng thanh toán", "AMOUNT_MISMATCH");

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
      throw new ConflictError("Học phí đã được thanh toán đủ", "TUITION_ALREADY_PAID");
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
  const bankTransactionNo = data?.bankTransactionNo?.trim() || batch.bankTransactionNo?.trim() || null;
  const transactionReference =
    data?.transactionReference?.trim() || batch.transactionReference?.trim() || null;
  if (batch.paymentMethod === "BANK_TRANSFER" && !bankAccountId) {
    throw new ConflictError("Thanh toán chuyển khoản phải có tài khoản nhận tiền");
  }
  if (batch.paymentMethod === "BANK_TRANSFER" && !bankTransactionNo && !transactionReference) {
    throw new ConflictError("Thanh toán chuyển khoản phải có mã giao dịch hoặc mã tham chiếu");
  }
  if (
    batch.paymentMethod === "BANK_TRANSFER" &&
    data?.bankAccountId &&
    batch.bankAccountId &&
    data.bankAccountId !== batch.bankAccountId
  ) {
    throw new ConflictError("Tài khoản ngân hàng không khớp với đợt thanh toán");
  }
  if (
    batch.paymentMethod === "CASH" &&
    (bankAccountId || batch.bankTransactionNo || batch.transactionReference || data?.bankAccountId || data?.bankTransactionNo)
  ) {
    throw new ConflictError("Thanh toán tiền mặt không được chứa thông tin giao dịch ngân hàng");
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
        bankTransactionNo: batch.paymentMethod === "CASH" ? undefined : bankTransactionNo,
        transactionReference:
          batch.paymentMethod === "CASH"
            ? undefined
            : transactionReference,
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
        receiverName: batch.payerName || batch.studentId,
        amount: allocation.amount,
      },
    });
    await saveTuitionReceiptSnapshot(tx, receipt.id, {
      version: 1,
      receiptNo: receipt.receiptNo,
      issuedAt: paymentReceiptIssuedAt.toISOString(),
      student: { code: batch.student.code, fullName: batch.student.fullName },
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
    const nextStatus = getStoredTuitionFeeStatus(allocation.tuitionFee.finalAmount, paidAmount);
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
      receiverName: batch.payerName || batch.studentId,
      amount: batch.totalAmount,
    },
  });
  await savePaymentBatchReceiptSnapshot(tx, batchReceipt.id, {
    version: 1,
    receiptNo: batchReceipt.receiptNo,
    issuedAt: paymentReceiptIssuedAt.toISOString(),
    student: { code: batch.student.code, fullName: batch.student.fullName },
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
      bankTransactionNo: batch.paymentMethod === "CASH" ? null : bankTransactionNo,
      transactionReference:
        batch.paymentMethod === "CASH"
          ? null
          : transactionReference,
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
      throw new ConflictError("Ngày chuyển khoản được lấy từ sao kê khi đối soát");
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
      throw new ConflictError("Thanh toán tiền mặt không được gắn tài khoản ngân hàng");
    if (data.paymentMethod === "CASH" && data.transactionReference)
      throw new ConflictError("Thanh toán tiền mặt không được có mã giao dịch ngân hàng");
    if (data.paymentMethod === "BANK_TRANSFER" && !data.bankAccountId)
      throw new ConflictError("Thanh toán chuyển khoản phải có tài khoản nhận tiền");
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
    for (const tuitionFeeId of data.tuitionFeeIds) {
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM tuition_fees WHERE id = ${tuitionFeeId}::uuid FOR UPDATE`,
      );
    }

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
        (paidByFee.get(payment.tuitionFeeId) ?? new Prisma.Decimal(0)).add(payment.amount),
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
      const amount = rawAmount === undefined
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
      const sameAmounts = duplicate.allocations.every(
        (allocation) => {
          const expectedAmount = requestedAmounts.get(allocation.tuitionFeeId);
          if (!expectedAmount) return false;
          return allocation.amount.equals(expectedAmount);
        },
      );
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
        bankAccountId: data.paymentMethod === "BANK_TRANSFER" ? data.bankAccountId : undefined,
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
        student: { code: fees[0]!.student.code, fullName: fees[0]!.student.fullName },
        fees: fees.map((fee) => toFeeSnapshot(fee, requestedAmounts.get(fee.id))),
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
    return completePaymentBatch(tx, batch.id, actorId, {
      paymentDate: requestedPaymentDate,
    }, auditContext);
    return batch;
  };
  return transaction ? execute(transaction) : prisma.$transaction(execute);
}

export async function listPaymentBatches(params: {
  transactionCode?: string;
  studentCode?: string;
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
  const where: Prisma.PaymentBatchWhereInput = {
    ...(transactionSearchValues.length
      ? {
          OR: [
            ...transactionSearchValues.flatMap((value) => [
              { batchNo: { contains: value, mode: "insensitive" as const } },
              { bankTransactionNo: { contains: value, mode: "insensitive" as const } },
              { transactionReference: { contains: value, mode: "insensitive" as const } },
            ]),
          ],
        }
      : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.studentCode
      ? {
          student: {
            code: { contains: params.studentCode, mode: "insensitive" },
          },
        }
      : {}),
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
      batch.status === PaymentBatchStatus.SUCCESS ? batch.receipt : null,
    createdByUser: usersById.get(batch.createdBy) || null,
    updatedByUser: usersById.get(batch.updatedBy) || null,
    confirmedByUser: batch.confirmedBy
      ? usersById.get(batch.confirmedBy) || null
      : null,
    receivedByUser:
      usersById.get(
        batch.payments.find((payment) => payment.receivedBy)?.receivedBy ||
          (batch.paymentMethod === "CASH" ? auditLogs[0]?.performedBy : undefined) ||
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
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM payment_batches WHERE id = ${batchId}::uuid FOR UPDATE`,
    );
    const batch = await tx.paymentBatch.findUnique({
      where: { id: batchId },
      include: { allocations: true },
    });
    if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");
    if (batch.status !== PaymentBatchStatus.PENDING)
    throw new ConflictError("Chỉ có thể hủy đợt thanh toán đang chờ đối soát");

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
    return cancelled;
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
  if (!cashPaymentDate) throw new ConflictError("Ngày nhận tiền mặt là bắt buộc");
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
    return completePaymentBatch(tx, batchId, actorId, {
      paymentDate: cashPaymentDate,
      paymentContent: cashPaymentNote,
    }, auditContext);
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
