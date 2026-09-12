import {
  Prisma,
  TuitionFeeStatus,
  TuitionPaymentStatus,
  PaymentBatchStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { PaymentBatchCreate } from "../schemas/payment-batch.schema";
import { buildVietQrUrl } from "@/modules/finance/tuition/services/vietqr.service";
import { getEffectiveTuitionFeeStatus } from "@/modules/finance/tuition/utils/tuition-status";
import {
  savePaymentBatchNoticeSnapshot,
  savePaymentBatchReceiptSnapshot,
  saveTuitionReceiptSnapshot,
  toFeeSnapshot,
} from "./payment-document-snapshot";

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
    throw new ConflictError("Tổng phân bổ không khớp tổng thanh toán");

  for (const allocation of batch.allocations) {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM tuition_fees WHERE id = ${allocation.tuitionFeeId}::uuid FOR UPDATE`,
    );
    const fee = await tx.tuitionFee.findUnique({
      where: { id: allocation.tuitionFeeId },
      include: {
        payments: {
          where: { paymentStatus: TuitionPaymentStatus.SUCCESS },
          select: { id: true },
        },
      },
    });
    if (!fee) throw new NotFoundError("Không tìm thấy khoản học phí");
    if (fee.payments.length > 0)
      throw new ConflictError("TUITION_ALREADY_PAID");
    if (
      fee.status !== TuitionFeeStatus.UNPAID &&
      fee.status !== TuitionFeeStatus.OVERDUE
    )
      throw new ConflictError(
        `Học phí ${fee.feeNo} không còn đủ điều kiện thanh toán`,
      );
    if (!allocation.amount.greaterThan(0))
      throw new ConflictError("Số tiền thanh toán phải lớn hơn 0");
    if (!allocation.amount.equals(fee.finalAmount))
      throw new ConflictError(
        `Số tiền phân bổ của ${fee.feeNo} không khớp toàn bộ học phí`,
      );
  }
  const paymentReceiptIssuedAt = new Date();
  const paymentDate = data?.paymentDate || batch.paymentDate;
  const bankAccountId = data?.bankAccountId ?? batch.bankAccountId;
  if (batch.paymentMethod === "BANK_TRANSFER" && !bankAccountId) {
    throw new ConflictError("Thanh toán chuyển khoản phải có tài khoản nhận tiền");
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
        bankTransactionNo: batch.paymentMethod === "CASH" ? undefined : data?.bankTransactionNo,
        transactionReference:
          batch.paymentMethod === "CASH"
            ? undefined
            : data?.transactionReference || batch.transactionReference,
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
      tuitionFee: toFeeSnapshot(allocation.tuitionFee),
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
      },
    });
    await tx.tuitionFee.update({
      where: { id: allocation.tuitionFeeId },
      data: {
        status: TuitionFeeStatus.PAID,
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
      },
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "TUITION_FEE",
        entityId: allocation.tuitionFeeId,
        action: "PAID",
        dataAfter: {
          paymentId: payment.id,
          paymentBatchId: batch.id,
          status: TuitionFeeStatus.PAID,
        },
        performedBy: actorId,
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
    fees: batch.allocations.map((allocation) => toFeeSnapshot(allocation.tuitionFee)),
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
    },
  });
  const completed = await tx.paymentBatch.update({
    where: { id: batch.id },
    data: {
      status: PaymentBatchStatus.SUCCESS,
      paymentDate,
      bankAccountId,
      bankTransactionNo: batch.paymentMethod === "CASH" ? null : data?.bankTransactionNo,
      transactionReference:
        batch.paymentMethod === "CASH"
          ? null
          : data?.transactionReference || batch.transactionReference,
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
    },
  });
  return completed;
}

export async function createPaymentBatch(
  data: PaymentBatchCreate,
  actorId: string,
  transaction?: Prisma.TransactionClient,
) {
  const execute = async (tx: Prisma.TransactionClient) => {
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
    if (data.bankAccountId) {
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM bank_accounts WHERE id = ${data.bankAccountId}::uuid FOR UPDATE`,
      );
      const bankAccount = await tx.bankAccount.findUnique({
        where: { id: data.bankAccountId },
        select: { id: true, isActive: true },
      });
      if (!bankAccount || !bankAccount.isActive)
        throw new ConflictError("Tài khoản ngân hàng không hoạt động");
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
          fee.status !== TuitionFeeStatus.OVERDUE,
      )
    )
      throw new ConflictError(
        "Danh sách có học phí không còn đủ điều kiện thanh toán",
      );
    if (fees.some((fee) => !fee.finalAmount.greaterThan(0)))
      throw new ConflictError("Học phí phải có số tiền lớn hơn 0");
    const paid = await tx.tuitionPayment.findMany({
      where: {
        tuitionFeeId: { in: data.tuitionFeeIds },
        paymentStatus: TuitionPaymentStatus.SUCCESS,
      },
      select: { tuitionFeeId: true },
    });
    if (paid.length)
      throw new ConflictError("Một hoặc nhiều học phí đã được thanh toán");
    const totalAmount = fees.reduce(
      (sum, fee) => sum.add(fee.finalAmount),
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
      if (!samePaymentMethod || !sameBankAccount) {
        throw new ConflictError(
          `Các khoản học phí đã thuộc đợt ${duplicate.batchNo} với phương thức thanh toán khác`,
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
        bankAccountId: data.paymentMethod === "BANK_TRANSFER" ? data.bankAccountId : undefined,
        transactionReference: data.transactionReference,
        payerName: data.payerName,
        paymentContent: data.note,
        createdBy: actorId,
        updatedBy: actorId,
        allocations: {
          create: fees.map((fee) => ({
            tuitionFeeId: fee.id,
            amount: fee.finalAmount,
          })),
        },
      },
      include: {
        allocations: { include: { tuitionFee: true } },
        student: true,
      },
    });
    await savePaymentBatchNoticeSnapshot(tx, batch.id, {
      version: 1,
      student: { code: fees[0]!.student.code, fullName: fees[0]!.student.fullName },
      fees: fees.map((fee) => toFeeSnapshot(fee)),
    });
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
      },
    });
    if (data.paymentMethod === "CASH")
      return completePaymentBatch(tx, batch.id, actorId);
    return batch;
  };
  return transaction ? execute(transaction) : prisma.$transaction(execute);
}

export async function listPaymentBatches(params: {
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
  const where: Prisma.PaymentBatchWhereInput = {
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
      },
    });
    return cancelled;
  });
}

export async function convertPaymentBatchToCash(
  batchId: string,
  actorId: string,
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
      throw new ConflictError(
        "Chỉ có thể chuyển sang tiền mặt với đợt đang chờ xử lý",
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
        dataAfter: { paymentMethod: "CASH", reason: "Chuyển sang thanh toán tiền mặt" },
        performedBy: actorId,
      },
    });
    return completePaymentBatch(tx, batchId, actorId, {
      paymentDate: new Date(),
      paymentContent: "Thanh toán tiền mặt",
    });
  });
}

export async function getPaymentBatchQr(batchId: string, actorId: string) {
  const batch = await prisma.paymentBatch.findUnique({
    where: { id: batchId },
    include: { student: true },
  });
  if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");
  if (batch.status !== PaymentBatchStatus.PENDING)
    throw new ConflictError("Đợt thanh toán không còn hiệu lực");
  if (batch.paymentMethod !== "BANK_TRANSFER")
    throw new ConflictError("Chỉ payment batch chuyển khoản mới có mã QR");
  if (!batch.bankAccountId)
    throw new ConflictError("Đợt thanh toán chưa gắn tài khoản ngân hàng");
  const account = await prisma.bankAccount.findFirst({
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
  await prisma.tuitionAuditLog.create({
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
    },
  });
  return {
    batchNo: batch.batchNo,
    amount: batch.totalAmount,
    account,
    qrUrl,
  };
}
