import { prisma } from "@/lib/prisma";
import { sumDecimals, toDecimal } from "@/lib/decimal";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { StudentFeeAssetService } from "@/modules/finance/student-fees/services/student-fee-asset.service";
import type {
  FeeStatus,
  PaymentNoticeStatus,
  PaymentQrStatus,
  PaymentRequestStatus,
  Prisma,
} from "@prisma/client";
import { PaymentStatus } from "@prisma/client";
import type { StudentFeeFilter } from "@/modules/finance/student-fees/schemas/student-fee.schema";

const paymentRequestDetailInclude = {
  paymentAccount: true,
  qrCode: true,
  notices: {
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
  },
  payments: true,
} satisfies Prisma.PaymentRequestInclude;

const studentFeeDetailInclude = {
  student: true,
  class: true,
  payments: true,
  paymentRequests: {
    orderBy: {
      createdAt: "desc",
    },
    include: paymentRequestDetailInclude,
  },
} satisfies Prisma.StudentFeeInclude;

export type StudentFeeWithRelations = Prisma.StudentFeeGetPayload<{
  include: typeof studentFeeDetailInclude;
}>;

function parseBillingMonth(month: string): {
  billingYear: number;
  billingMonth: number;
} {
  const [yearString, monthString] = month.split("-");
  const billingYear = Number(yearString);
  const billingMonth = Number(monthString);

  if (
    !Number.isInteger(billingYear) ||
    !Number.isInteger(billingMonth) ||
    billingMonth < 1 ||
    billingMonth > 12
  ) {
    throw new ConflictError("Month must be in YYYY-MM format");
  }

  return { billingYear, billingMonth };
}

export class StudentFeeService {
  private static getClient(
    tx?: Prisma.TransactionClient,
  ): Prisma.TransactionClient | typeof prisma {
    return tx ?? prisma;
  }

  private static validateAmounts(amountInput: number, discountInput?: number) {
    const amount = toDecimal(amountInput);
    const discount = toDecimal(discountInput ?? 0);

    if (amount.lte(0)) {
      throw new ConflictError("Số tiền học phí phải lớn hơn 0");
    }

    if (discount.lt(0)) {
      throw new ConflictError("Giảm giá không được âm");
    }

    if (discount.gt(amount)) {
      throw new ConflictError("Giảm giá không được lớn hơn học phí");
    }

    return {
      amount,
      discount,
      finalAmount: amount.sub(discount),
    };
  }

  private static buildPaymentCode(fee: {
    billingYear: number;
    billingMonth: number;
    student: { code: string };
    class: { code: string };
  }) {
    return `QR-${fee.billingYear}${String(fee.billingMonth).padStart(2, "0")}-${fee.student.code}-${fee.class.code}-${Date.now()}`;
  }

  private static buildNoticeNumber(fee: {
    billingYear: number;
    billingMonth: number;
    student: { code: string };
    class: { code: string };
  }) {
    return `PN-${fee.billingYear}${String(fee.billingMonth).padStart(2, "0")}-${fee.student.code}-${fee.class.code}-${Date.now()}`;
  }

  private static getBankBin(bankCode: string) {
    const mapping: Record<string, string> = {
      VCB: "970436",
      ACB: "970416",
      BIDV: "970418",
    };

    return mapping[bankCode.toUpperCase()] ?? bankCode;
  }

  private static buildTlv(id: string, value: string) {
    const byteLength = Buffer.byteLength(value, "utf8");
    return `${id}${String(byteLength).padStart(2, "0")}${value}`;
  }

  private static calculateCrc16(payload: string) {
    let crc = 0xffff;

    for (let index = 0; index < payload.length; index += 1) {
      crc ^= payload.charCodeAt(index) << 8;

      for (let bit = 0; bit < 8; bit += 1) {
        crc =
          (crc & 0x8000) !== 0
            ? ((crc << 1) ^ 0x1021) & 0xffff
            : (crc << 1) & 0xffff;
      }
    }

    return crc.toString(16).toUpperCase().padStart(4, "0");
  }

  private static normalizeTransferContent(content: string) {
    return content
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9\s\-_.]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50);
  }

  private static buildVietQrPayload(input: {
    bankCode: string;
    accountNumber: string;
    amount: string | number;
    transferContent: string;
  }) {
    const amount = Math.round(Number(input.amount));

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid QR amount");
    }

    const bankBin = this.getBankBin(input.bankCode);

    const accountNumber = input.accountNumber.replace(/\s+/g, "").trim();

    if (!bankBin || bankBin.length !== 6) {
      throw new Error("Invalid bank code");
    }

    if (!accountNumber) {
      throw new Error("Invalid account number");
    }

    const transferContent = this.normalizeTransferContent(
      input.transferContent,
    );

    const beneficiaryOrg = [
      this.buildTlv("00", bankBin),
      this.buildTlv("01", accountNumber),
    ].join("");

    const merchantAccountInfo = [
      this.buildTlv("00", "A000000727"),
      this.buildTlv("01", beneficiaryOrg),
      this.buildTlv("02", "QRIBFTTA"),
    ].join("");

    const additionalData = this.buildTlv("08", transferContent);

    const payloadWithoutCrc = [
      this.buildTlv("00", "01"),
      this.buildTlv("01", "12"),
      this.buildTlv("38", merchantAccountInfo),
      this.buildTlv("53", "704"),
      this.buildTlv("54", String(amount)),
      this.buildTlv("58", "VN"),
      this.buildTlv("62", additionalData),
      "6304",
    ].join("");

    const crc = this.calculateCrc16(payloadWithoutCrc);

    return `${payloadWithoutCrc}${crc}`;
  }

  private static async getStudentFeeOrThrow(
    studentFeeId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = this.getClient(tx);
    const fee = await db.studentFee.findUnique({
      where: { id: studentFeeId },
      include: studentFeeDetailInclude,
    });

    if (!fee) {
      throw new NotFoundError("Không tìm thấy học phí");
    }

    return fee;
  }

  private static async getDefaultPaymentRequestAccount(
    tx: Prisma.TransactionClient,
  ) {
    const account = await tx.paymentAccount.findFirst({
      where: {
        isActive: true,
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    console.log("Default payment account:", account);

    if (!account) {
      throw new ConflictError("Chưa cấu hình tài khoản nhận học phí");
    }

    return account;
  }

  private static async getActivePaymentRequest(
    studentFeeId: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.paymentRequest.findFirst({
      where: {
        studentFeeId,
        status: "ACTIVE",
      },
      include: paymentRequestDetailInclude,
      orderBy: [{ createdAt: "desc" }],
    });
  }

  private static async createPaymentRequestForFee(
    fee: {
      id: string;
      billingYear: number;
      billingMonth: number;
      student: { code: string };
      class: { code: string };
      finalAmount: Prisma.Decimal | number;
      dueDate: Date | null;
    },
    tx: Prisma.TransactionClient,
  ) {
    const paymentAccount = await this.getDefaultPaymentRequestAccount(tx);
    const requestedAmount = toDecimal(fee.finalAmount);
    const transferContent = `HP-${fee.billingYear}${String(fee.billingMonth).padStart(2, "0")}-${fee.student.code}-${fee.class.code}`;

    return tx.paymentRequest.create({
      data: {
        studentFeeId: fee.id,
        paymentAccountId: paymentAccount.id,
        paymentCode: this.buildPaymentCode(fee),
        requestedAmount: requestedAmount.toNumber(),
        transferContent,
        expiredAt: fee.dueDate,
        status: "ACTIVE",
      },
      include: paymentRequestDetailInclude,
    });
  }

  private static async invalidateDependentArtifacts(
    studentFeeId: string,
    tx: Prisma.TransactionClient,
  ) {
    const activeRequests = await tx.paymentRequest.findMany({
      where: {
        studentFeeId,
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    const requestIds = activeRequests.map((request) => request.id);

    if (requestIds.length === 0) {
      return;
    }

    await tx.paymentQrCode.updateMany({
      where: {
        paymentRequestId: { in: requestIds },
        status: "ACTIVE",
      },
      data: {
        status: "EXPIRED",
      },
    });

    await tx.paymentNotice.updateMany({
      where: {
        paymentRequestId: { in: requestIds },
        isLatest: true,
      },
      data: {
        isLatest: false,
      },
    });

    await tx.paymentRequest.updateMany({
      where: {
        id: { in: requestIds },
      },
      data: {
        status: "EXPIRED",
      },
    });
  }

  static async invalidateFlowArtifacts(
    studentFeeId: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (tx) {
      await this.invalidateDependentArtifacts(studentFeeId, tx);
      return;
    }

    await prisma.$transaction(async (innerTx) => {
      await this.invalidateDependentArtifacts(studentFeeId, innerTx);
    });
  }

  private static resolveQrStepStatus(
    paymentRequests: Array<{
      status: PaymentRequestStatus;
      qrCode?: { status: PaymentQrStatus } | null;
    }>,
  ): "PENDING" | "GENERATED" | "FAILED" {
    if (
      paymentRequests.some(
        (request) =>
          request.status === "ACTIVE" && request.qrCode?.status === "ACTIVE",
      )
    ) {
      return "GENERATED";
    }

    if (
      paymentRequests.some(
        (request) =>
          request.status === "EXPIRED" ||
          request.status === "CANCELLED" ||
          request.qrCode?.status === "EXPIRED" ||
          request.qrCode?.status === "CANCELLED",
      )
    ) {
      return "FAILED";
    }

    return "PENDING";
  }

  private static resolveNoticeStepStatus(
    notices: Array<{ status: PaymentNoticeStatus; isLatest: boolean }>,
  ): "PENDING" | "GENERATED" | "SENT" | "FAILED" {
    const latest = notices.find((notice) => notice.isLatest);

    if (!latest) {
      return "PENDING";
    }

    if (latest.status === "SENT") {
      return "SENT";
    }

    if (latest.status === "GENERATED" || latest.status === "PRINTED") {
      return "GENERATED";
    }

    if (latest.status === "CANCELLED") {
      return "FAILED";
    }

    return "PENDING";
  }

  private static async mapFeeFlowState(fee: StudentFeeWithRelations) {
    const activeRequest =
      fee.paymentRequests.find((request) => request.status === "ACTIVE") ??
      fee.paymentRequests[0] ??
      null;
    const activeQr = activeRequest?.qrCode
      ? {
          id: activeRequest.qrCode.id,
          paymentRequestId: activeRequest.qrCode.paymentRequestId,
          amount: Number(activeRequest.requestedAmount),
          transferContent: activeRequest.transferContent,
          qrPayload: activeRequest.qrCode.qrPayload,
          qrImageUrl: await StudentFeeAssetService.generateQrDataUrl(
            activeRequest.qrCode.qrPayload,
          ),
          status: activeRequest.qrCode.status,
        }
      : null;
    const latestNotice =
      fee.paymentRequests
        .flatMap((request) => request.notices)
        .find((notice) => notice.isLatest) ?? null;

    return {
      ...fee,
      month: `${fee.billingYear}-${String(fee.billingMonth).padStart(2, "0")}`,
      activeQr,
      latestNotice,
      flowStatus: {
        tuitionFee: "GENERATED" as const,
        qr: this.resolveQrStepStatus(fee.paymentRequests),
        temporaryInvoice: this.resolveNoticeStepStatus(
          fee.paymentRequests.flatMap((request) => request.notices),
        ),
        paymentNotice: this.resolveNoticeStepStatus(
          fee.paymentRequests.flatMap((request) => request.notices),
        ),
      },
    };
  }

  static async createStudentFee(data: {
    studentId: string;
    classId: string;
    month: string;
    amount: number;
    discount?: number;
    dueDate: Date;
    status?: FeeStatus;
    note?: string;
  }): Promise<StudentFeeWithRelations> {
    const { billingYear, billingMonth } = parseBillingMonth(data.month);
    const amounts = this.validateAmounts(data.amount, data.discount);

    return prisma.$transaction(async (tx) => {
      const existing = await tx.studentFee.findFirst({
        where: {
          studentId: data.studentId,
          classId: data.classId,
          billingYear,
          billingMonth,
        },
      });

      if (existing) {
        throw new ConflictError(
          "Học phí đã tồn tại cho học viên, lớp và tháng này",
        );
      }

      const fee = await tx.studentFee.create({
        data: {
          studentId: data.studentId,
          classId: data.classId,
          billingYear,
          billingMonth,
          amount: amounts.amount.toNumber(),
          discount: amounts.discount.toNumber(),
          finalAmount: amounts.finalAmount.toNumber(),
          paidAmount: 0,
          outstandingAmount: amounts.finalAmount.toNumber(),
          dueDate: data.dueDate,
          status: data.status ?? "UNPAID",
          note: data.note,
        },
      });

      const createdFee = await tx.studentFee.findUnique({
        where: { id: fee.id },
        include: {
          student: true,
          class: true,
        },
      });

      if (createdFee) {
        await this.createPaymentRequestForFee(createdFee, tx);
      }

      const created = await tx.studentFee.findUnique({
        where: { id: fee.id },
        include: studentFeeDetailInclude,
      });

      if (!created) {
        throw new NotFoundError("Không tìm thấy học phí");
      }

      return created;
    });
  }

  static async createBulkFeesForClass(data: {
    classId: string;
    studentIds: string[];
    month: string;
    amount: number;
    discount?: number;
    dueDate: Date;
    note?: string;
  }) {
    const { billingYear, billingMonth } = parseBillingMonth(data.month);
    const amounts = this.validateAmounts(data.amount, data.discount);

    return prisma.$transaction(async (tx) => {
      const classData = await tx.class.findUnique({
        where: { id: data.classId },
        select: {
          id: true,
          code: true,
        },
      });

      if (!classData) {
        throw new NotFoundError("Không tìm thấy lớp học");
      }

      const classStudents = await tx.classStudent.findMany({
        where: {
          classId: data.classId,
          studentId: { in: data.studentIds },
        },
        select: {
          studentId: true,
          student: {
            select: {
              code: true,
            },
          },
        },
      });

      if (classStudents.length === 0) {
        throw new ConflictError("Lớp hiện không có học viên phù hợp");
      }

      const existingFees = await tx.studentFee.findMany({
        where: {
          classId: data.classId,
          billingYear,
          billingMonth,
          studentId: {
            in: classStudents.map((cs) => cs.studentId),
          },
        },
        select: {
          studentId: true,
        },
      });

      if (existingFees.length > 0) {
        throw new ConflictError("Đã tồn tại học phí trong danh sách được chọn");
      }

      const feesToCreate = classStudents.map((cs) => ({
        studentId: cs.studentId,
        classId: data.classId,
        billingYear,
        billingMonth,
        amount: amounts.amount.toNumber(),
        discount: amounts.discount.toNumber(),
        finalAmount: amounts.finalAmount.toNumber(),
        paidAmount: 0,
        outstandingAmount: amounts.finalAmount.toNumber(),
        dueDate: data.dueDate,
        status: "UNPAID" as FeeStatus,
        note: data.note,
      }));

      await tx.studentFee.createMany({
        data: feesToCreate,
      });

      const createdFees = await tx.studentFee.findMany({
        where: {
          classId: data.classId,
          billingYear,
          billingMonth,
          studentId: { in: classStudents.map((cs) => cs.studentId) },
        },
        include: {
          student: true,
          class: true,
        },
      });

      const paymentAccount = await this.getDefaultPaymentRequestAccount(tx);
      await tx.paymentRequest.createMany({
        data: createdFees.map((fee) => {
          const studentCode =
            classStudents.find((cs) => cs.studentId === fee.studentId)?.student
              .code ?? fee.studentId;

          return {
            studentFeeId: fee.id,
            paymentAccountId: paymentAccount.id,
            paymentCode: this.buildPaymentCode({
              billingYear: fee.billingYear,
              billingMonth: fee.billingMonth,
              student: { code: studentCode },
              class: { code: classData.code },
            }),
            requestedAmount: toDecimal(fee.finalAmount).toNumber(),
            transferContent: `HP-${fee.billingYear}${String(fee.billingMonth).padStart(2, "0")}-${studentCode}-${classData.code}`,
            expiredAt: data.dueDate,
            status: "ACTIVE" as const,
          };
        }),
      });

      return {
        created: feesToCreate.length,
        skipped: 0,
      };
    });
  }

  private static async calculateDebtWithClient(
    studentFeeId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = this.getClient(tx);
    const fee = await db.studentFee.findUnique({
      where: { id: studentFeeId },
      include: { payments: true },
    });

    if (!fee) {
      throw new NotFoundError("Không tìm thấy học phí");
    }

    const totalPaid = sumDecimals(
      fee.payments
        .filter((payment) => payment.status === PaymentStatus.CONFIRMED)
        .map((payment) => payment.amount),
    );
    const netAmount = toDecimal(fee.finalAmount);
    const outstanding = netAmount.sub(totalPaid);

    const status: FeeStatus = outstanding.lte(0)
      ? "PAID"
      : totalPaid.gt(0)
        ? "PARTIAL"
        : "UNPAID";

    return {
      totalAmount: netAmount,
      totalPaid,
      outstanding,
      status,
    };
  }

  static async calculateDebt(studentFeeId: string) {
    return this.calculateDebtWithClient(studentFeeId);
  }

  static async syncFeeFinancialState(
    studentFeeId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = this.getClient(tx);
    const debt = await this.calculateDebtWithClient(studentFeeId, tx);

    await db.studentFee.update({
      where: { id: studentFeeId },
      data: {
        status: debt.status,
        paidAmount: debt.totalPaid.toNumber(),
        outstandingAmount: debt.outstanding.toNumber(),
      },
    });
  }

  static async getStudentFees(filter: StudentFeeFilter) {
    const { page, pageSize, search, status, classId, studentId, month } =
      filter;
    const skip = (page - 1) * pageSize;
    const billing = month ? parseBillingMonth(month) : undefined;
    const searchBilling =
      search && /^\d{4}-\d{2}$/.test(search)
        ? parseBillingMonth(search)
        : undefined;

    const where: Prisma.StudentFeeWhereInput = {
      ...(search && {
        OR: [
          {
            student: {
              code: { contains: search, mode: "insensitive" },
            },
          },
          {
            student: {
              fullName: { contains: search, mode: "insensitive" },
            },
          },
          {
            class: {
              code: { contains: search, mode: "insensitive" },
            },
          },
          {
            class: {
              name: { contains: search, mode: "insensitive" },
            },
          },
          ...(searchBilling
            ? [
                {
                  billingYear: searchBilling.billingYear,
                  billingMonth: searchBilling.billingMonth,
                } satisfies Prisma.StudentFeeWhereInput,
              ]
            : []),
        ],
      }),
    };

    if (status) {
      if (Array.isArray(status)) {
        where.status = { in: status as FeeStatus[] };
      } else {
        where.status = status as FeeStatus;
      }
    }

    if (classId) where.classId = classId;
    if (studentId) where.studentId = studentId;
    if (billing) {
      where.billingYear = billing.billingYear;
      where.billingMonth = billing.billingMonth;
    }

    const [items, total] = await Promise.all([
      prisma.studentFee.findMany({
        where,
        include: studentFeeDetailInclude,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.studentFee.count({ where }),
    ]);

    return {
      items: await Promise.all(items.map((item) => this.mapFeeFlowState(item))),
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
    };
  }

  static async getStudentFeeById(id: string) {
    const fee = await prisma.studentFee.findUnique({
      where: { id },
      include: studentFeeDetailInclude,
    });

    return fee ? this.mapFeeFlowState(fee) : null;
  }

  static async updateStudentFee(
    id: string,
    data: {
      amount?: number;
      discount?: number;
      dueDate?: Date;
      note?: string;
      status?: FeeStatus;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const fee = await tx.studentFee.findUnique({
        where: { id },
        include: {
          payments: true,
        },
      });

      if (!fee) {
        throw new NotFoundError("Không tìm thấy học phí");
      }

      const nextAmount =
        data.amount !== undefined
          ? toDecimal(data.amount)
          : toDecimal(fee.amount);
      const nextDiscount =
        data.discount !== undefined
          ? toDecimal(data.discount)
          : toDecimal(fee.discount);
      const amounts = this.validateAmounts(
        nextAmount.toNumber(),
        nextDiscount.toNumber(),
      );
      const totalPaid = sumDecimals(
        fee.payments.map((payment) => payment.amount),
      );

      if (totalPaid.gt(amounts.finalAmount)) {
        throw new ConflictError(
          "Số tiền đã thanh toán không được lớn hơn học phí sau giảm giá",
        );
      }

      const shouldInvalidateArtifacts =
        data.amount !== undefined ||
        data.discount !== undefined ||
        data.dueDate !== undefined;

      await tx.studentFee.update({
        where: { id },
        data: {
          ...data,
          amount: amounts.amount.toNumber(),
          discount: amounts.discount.toNumber(),
          finalAmount: amounts.finalAmount.toNumber(),
          paidAmount: totalPaid.toNumber(),
          outstandingAmount: amounts.finalAmount.sub(totalPaid).toNumber(),
        },
      });

      if (shouldInvalidateArtifacts) {
        await this.invalidateDependentArtifacts(id, tx);
      }

      await this.syncFeeFinancialState(id, tx);

      return this.getStudentFeeOrThrow(id, tx);
    });
  }

  static async generatePaymentQr(studentFeeId: string) {
    return prisma.$transaction(async (tx) => {
      const fee = await this.getStudentFeeOrThrow(studentFeeId, tx);
      const outstanding = toDecimal(fee.outstandingAmount);

      if (outstanding.lte(0)) {
        throw new ConflictError("Học phí đã thanh toán đủ, không cần tạo QR");
      }

      let paymentRequest = await this.getActivePaymentRequest(studentFeeId, tx);

      if (
        paymentRequest?.qrCode?.status === "ACTIVE" &&
        toDecimal(paymentRequest.requestedAmount).eq(outstanding)
      ) {
        throw new ConflictError("QR thanh toán hiện tại vẫn còn hiệu lực");
      }

      if (
        paymentRequest &&
        toDecimal(paymentRequest.requestedAmount).eq(outstanding) === false
      ) {
        const expiredRequest = paymentRequest;
        await tx.paymentRequest.update({
          where: { id: expiredRequest.id },
          data: { status: "EXPIRED" },
        });
        paymentRequest = null;
        if (expiredRequest.qrCode) {
          await tx.paymentQrCode.update({
            where: { paymentRequestId: expiredRequest.id },
            data: { status: "EXPIRED" },
          });
        }
      } else if (paymentRequest?.qrCode) {
        await tx.paymentQrCode.update({
          where: { paymentRequestId: paymentRequest.id },
          data: { status: "EXPIRED" },
        });
      }

      if (!paymentRequest) {
        paymentRequest = await this.createPaymentRequestForFee(
          {
            id: fee.id,
            billingYear: fee.billingYear,
            billingMonth: fee.billingMonth,
            student: { code: fee.student.code },
            class: { code: fee.class.code },
            finalAmount: fee.finalAmount,
            dueDate: fee.dueDate,
          },
          tx,
        );
      }

      const qrPayload = this.buildVietQrPayload({
        bankCode: paymentRequest.paymentAccount.bankCode,
        accountNumber: paymentRequest.paymentAccount.accountNumber,
        amount: outstanding.toFixed(0),
        transferContent: paymentRequest.transferContent,
      });

      return tx.paymentQrCode.create({
        data: {
          paymentRequestId: paymentRequest.id,
          qrPayload,
          status: "ACTIVE",
        },
      });
    });
  }

  static async generatePaymentNotice(studentFeeId: string) {
    return prisma.$transaction(async (tx) => {
      const fee = await this.getStudentFeeOrThrow(studentFeeId, tx);
      const paymentRequests = fee.paymentRequests;
      const activeRequest =
        paymentRequests.find((request) => request.status === "ACTIVE") ??
        paymentRequests[0] ??
        null;

      if (!activeRequest?.qrCode) {
        throw new ConflictError("Cần tạo QR thanh toán trước khi tạo bill tạm");
      }

      const notices = paymentRequests.flatMap((request) => request.notices);
      const latestNotice = notices.find((notice) => notice.isLatest);
      const currentAmount = toDecimal(fee.outstandingAmount);

      if (
        latestNotice &&
        latestNotice.paymentRequestId === activeRequest.id &&
        latestNotice.status !== "CANCELLED" &&
        toDecimal(latestNotice.amount).eq(currentAmount) &&
        String(latestNotice.dueDate ?? "") === String(fee.dueDate ?? "")
      ) {
        throw new ConflictError("Bill tạm hiện tại vẫn còn hiệu lực");
      }

      await tx.paymentNotice.updateMany({
        where: {
          paymentRequestId: {
            in: paymentRequests.map((request) => request.id),
          },
          isLatest: true,
        },
        data: {
          isLatest: false,
        },
      });

      const latestVersion = notices[0]?.version ?? 0;
      const createdNotice = await tx.paymentNotice.create({
        data: {
          paymentRequestId: activeRequest.id,
          noticeNumber: this.buildNoticeNumber(fee),
          amount: currentAmount.toNumber(),
          dueDate: fee.dueDate,
          version: latestVersion + 1,
          isLatest: true,
          status: "GENERATED",
        },
      });

      const { pdfUrl } = await StudentFeeAssetService.generateNoticePdfAsset({
        notice: {
          noticeNumber: createdNotice.noticeNumber,
          dueDate: createdNotice.dueDate,
          amount: Number(createdNotice.amount),
          createdAt: createdNotice.createdAt,
        },
        fee: {
          billingYear: fee.billingYear,
          billingMonth: fee.billingMonth,
          amount: Number(fee.amount),
          discount: Number(fee.discount),
          finalAmount: Number(fee.finalAmount),
          student: {
            code: fee.student.code,
            fullName: fee.student.fullName,
            parentName: fee.student.parentName,
            phone: fee.student.phone,
          },
          class: {
            code: fee.class.code,
            name: fee.class.name,
          },
        },
        qrCode: {
          qrPayload: activeRequest.qrCode.qrPayload,
          transferContent: activeRequest.transferContent,
          paymentAccount: {
            bankName: activeRequest.paymentAccount.bankName,
            bankCode: activeRequest.paymentAccount.bankCode,
            accountNumber: activeRequest.paymentAccount.accountNumber,
            accountName: activeRequest.paymentAccount.accountName,
          },
        },
      });

      return tx.paymentNotice.update({
        where: { id: createdNotice.id },
        data: {
          pdfUrl,
        },
      });
    });
  }

  static async exportPaymentNoticePdf(studentFeeId: string) {
    return prisma.$transaction(async (tx) => {
      const fee = await this.getStudentFeeOrThrow(studentFeeId, tx);
      const paymentRequests = fee.paymentRequests;
      const notices = paymentRequests.flatMap((request) => request.notices);
      const latestNotice = notices.find((notice) => notice.isLatest);
      if (!latestNotice) {
        throw new ConflictError("Cần tạo bill tạm trước khi xuất PDF");
      }

      const activeRequest =
        paymentRequests.find((request) => request.status === "ACTIVE") ??
        paymentRequests[0] ??
        null;

      if (!activeRequest?.qrCode) {
        throw new ConflictError("Cần tạo QR thanh toán trước khi xuất PDF");
      }

      const { pdfUrl } = await StudentFeeAssetService.generateNoticePdfAsset({
        notice: {
          noticeNumber: latestNotice.noticeNumber,
          dueDate: latestNotice.dueDate,
          amount: Number(latestNotice.amount),
          createdAt: latestNotice.createdAt,
        },
        fee: {
          billingYear: fee.billingYear,
          billingMonth: fee.billingMonth,
          amount: Number(fee.amount),
          discount: Number(fee.discount),
          finalAmount: Number(fee.finalAmount),
          student: {
            code: fee.student.code,
            fullName: fee.student.fullName,
            parentName: fee.student.parentName,
            phone: fee.student.phone,
          },
          class: {
            code: fee.class.code,
            name: fee.class.name,
          },
        },
        qrCode: {
          qrPayload: activeRequest.qrCode.qrPayload,
          transferContent: activeRequest.transferContent,
          paymentAccount: {
            bankName: activeRequest.paymentAccount.bankName,
            bankCode: activeRequest.paymentAccount.bankCode,
            accountNumber: activeRequest.paymentAccount.accountNumber,
            accountName: activeRequest.paymentAccount.accountName,
          },
        },
      });

      const updatedNotice = await tx.paymentNotice.update({
        where: { id: latestNotice.id },
        data: {
          pdfUrl,
          printedAt: new Date(),
          status:
            latestNotice.status === "DRAFT" ||
            latestNotice.status === "GENERATED"
              ? "PRINTED"
              : latestNotice.status,
        },
      });

      return {
        pdfUrl,
        notice: updatedNotice,
      };
    });
  }

  static async sendPaymentNotice(studentFeeId: string, sendMethod = "MANUAL") {
    return prisma.$transaction(async (tx) => {
      const fee = await this.getStudentFeeOrThrow(studentFeeId, tx);
      const latestNotice = fee.paymentRequests
        .flatMap((request) => request.notices)
        .find((notice) => notice.isLatest);

      if (!latestNotice) {
        throw new ConflictError("Cần tạo bill tạm trước khi gửi thông báo");
      }

      if (!fee.student.phone) {
        throw new ConflictError(
          "Học viên chưa có số điện thoại để gửi thông báo",
        );
      }

      return tx.paymentNotice.update({
        where: { id: latestNotice.id },
        data: {
          sentAt: new Date(),
          sendMethod,
          status: "SENT",
        },
      });
    });
  }

  static async generateAll(studentFeeId: string) {
    await this.generatePaymentQr(studentFeeId).catch((error: unknown) => {
      if (
        error instanceof ConflictError &&
        error.message === "QR thanh toán hiện tại vẫn còn hiệu lực"
      ) {
        return;
      }

      throw error;
    });

    await this.generatePaymentNotice(studentFeeId).catch((error: unknown) => {
      if (
        error instanceof ConflictError &&
        error.message === "Bill tạm hiện tại vẫn còn hiệu lực"
      ) {
        return;
      }

      throw error;
    });

    await this.sendPaymentNotice(studentFeeId);

    return this.getStudentFeeById(studentFeeId);
  }

  static async deleteStudentFee(id: string) {
    const fee = await prisma.studentFee.findUnique({
      where: { id },
      include: { payments: { take: 1 } },
    });

    if (!fee) {
      throw new NotFoundError("Không tìm thấy học phí");
    }

    if (fee.payments.length > 0) {
      throw new ConflictError("Không thể xóa học phí đã có thanh toán");
    }

    return prisma.studentFee.delete({ where: { id } });
  }

  static async getStudentDebtSummary(studentId: string, classId?: string) {
    const where: Prisma.StudentFeeWhereInput = {
      studentId,
      ...(classId && { classId }),
    };

    const fees = await prisma.studentFee.findMany({
      where,
      include: { payments: true },
    });

    let totalFeeAmount = toDecimal(0);
    let totalPaid = toDecimal(0);

    for (const fee of fees) {
      const paid = sumDecimals(
        fee.payments
          .filter((payment) => payment.status === PaymentStatus.CONFIRMED)
          .map((payment) => payment.amount),
      );
      totalPaid = totalPaid.add(paid);
      totalFeeAmount = totalFeeAmount.add(toDecimal(fee.finalAmount));
    }

    return {
      totalFeeAmount,
      totalPaid,
      totalDebt: totalFeeAmount.sub(totalPaid),
      feeCount: fees.length,
      paidCount: fees.filter((fee) => {
        const paid = sumDecimals(
          fee.payments
            .filter((payment) => payment.status === PaymentStatus.CONFIRMED)
            .map((payment) => payment.amount),
        );
        return paid.greaterThanOrEqualTo(toDecimal(fee.finalAmount));
      }).length,
    };
  }
}
