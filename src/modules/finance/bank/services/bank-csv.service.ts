import crypto from "node:crypto";
import ExcelJS from "exceljs";
import { Prisma, PaymentBatchStatus, TuitionPaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { completePaymentBatch } from "@/modules/finance/payments/services/payment-batch.service";

export type ParsedBankRow = {
  rowNo: number;
  transactionDate: Date;
  description: string;
  amount: Prisma.Decimal;
  balance: Prisma.Decimal | null;
  transactionNo: string | null;
  raw: string;
};

type ReconciliationStatus = "AUTO_MATCHED" | "UNMATCHED" | "IGNORED" | "DUPLICATED";

type ReconciliationTokenPayload = {
  version: 1;
  expiresAt: number;
  bankAccountId: string;
  transactionHash: string;
  rowNo: number;
  transactionDate: string;
  bankTransactionNo: string | null;
  description: string;
  creditAmount: string;
  debitAmount: string;
  balanceAmount: string | null;
  paymentBatchId: string | null;
};

export type BankImportItem = {
  confirmationToken: string;
  rowNo: number;
  transactionDate: Date;
  bankTransactionNo: string | null;
  description: string;
  creditAmount: Prisma.Decimal;
  debitAmount: Prisma.Decimal;
  balanceAmount: Prisma.Decimal | null;
  reconciliationStatus: ReconciliationStatus;
  paymentBatch: {
    id: string;
    batchNo: string;
    totalAmount: Prisma.Decimal;
    student: { code: string; fullName: string };
    allocations: Array<{
      tuitionFeeId: string;
      amount: Prisma.Decimal;
      tuitionFee: { feeNo: string };
    }>;
  } | null;
};

export type BankImportResult = {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicatedRows: number;
  matchedRows: number;
  unmatchedRows: number;
  ignoredRows: number;
  items: BankImportItem[];
};

function parseMoney(value: string): Prisma.Decimal {
  const normalized = value.replace(/VND/gi, "").replace(/\s/g, "").trim();
  if (!normalized) return new Prisma.Decimal(0);

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  let numberValue = normalized;
  if (lastComma >= 0 && lastDot >= 0) {
    numberValue = lastComma > lastDot
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const fractionLength = normalized.length - lastComma - 1;
    numberValue = fractionLength <= 2 ? normalized.replace(",", ".") : normalized.replace(/,/g, "");
  } else if ((normalized.match(/\./g) || []).length > 1) {
    numberValue = normalized.replace(/\./g, "");
  } else if (lastDot >= 0) {
    const fractionLength = normalized.length - lastDot - 1;
    numberValue = fractionLength <= 2 ? normalized : normalized.replace(/\./g, "");
  }

  try {
    return new Prisma.Decimal(numberValue);
  } catch {
    throw new Error(`Số tiền không hợp lệ: ${value}`);
  }
}

function createVietnamDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): Date {
  // ExcelJS exposes an Excel date as a JS Date whose UTC components represent
  // the wall-clock values displayed in the workbook. Convert that Vietnamese
  // local time to the UTC instant used by the API/database.
  const result = new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second, millisecond));
  const vietnamDate = new Date(result.getTime() + 7 * 60 * 60 * 1000);
  if (
    vietnamDate.getUTCFullYear() !== year ||
    vietnamDate.getUTCMonth() !== month - 1 ||
    vietnamDate.getUTCDate() !== day ||
    vietnamDate.getUTCHours() !== hour ||
    vietnamDate.getUTCMinutes() !== minute ||
    vietnamDate.getUTCSeconds() !== second ||
    vietnamDate.getUTCMilliseconds() !== millisecond
  ) {
    throw new Error("Ngày giao dịch không hợp lệ");
  }
  return result;
}

function parseDate(value: string): Date {
  const text = value.trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) throw new Error(`Ngày giao dịch không hợp lệ: ${value}`);
  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearValue = Number(match[3]);
  const year = yearValue < 100 ? 2000 + yearValue : yearValue;
  const hour = Number(match[4] || 0);
  const minute = Number(match[5] || 0);
  const second = Number(match[6] || 0);
  try {
    return createVietnamDate(year, month, day, hour, minute, second);
  } catch {
    throw new Error(`Ngày giao dịch không hợp lệ: ${value}`);
  }
}

type BidvTableColumns = {
  date: number;
  description: number;
  amount: number;
  balance: number;
  transactionNo: number;
};

type TechcombankTableColumns = {
  date: number;
  description: number;
  detail: number;
  debit: number;
  credit: number;
  balance: number;
};

function findBidvTableHeader(worksheet: ExcelJS.Worksheet) {
  let header: { rowNumber: number; columns: BidvTableColumns } | null = null;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (header) return;
    const cells = Array.from({ length: Math.max(row.cellCount, 5) }, (_, index) =>
      normalize(row.getCell(index + 1).text),
    );
    const findColumn = (name: string) => cells.findIndex((cell) => cell === name) + 1;
    const columns = {
      date: findColumn("ngay giao dich"),
      description: findColumn("noi dung giao dich"),
      amount: findColumn("so tien"),
      balance: findColumn("so du"),
      transactionNo: findColumn("ma giao dich"),
    };
    if (Object.values(columns).every((column) => column > 0)) {
      header = { rowNumber, columns };
    }
  });
  return header;
}

function parseExcelDate(value: unknown, text: string): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return createVietnamDate(
      value.getUTCFullYear(),
      value.getUTCMonth() + 1,
      value.getUTCDate(),
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
      value.getUTCMilliseconds(),
    );
  }
  return parseDate(text);
}

function parseBidvTable(worksheet: ExcelJS.Worksheet, header: { rowNumber: number; columns: BidvTableColumns }) {
  const rows: ParsedBankRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= header.rowNumber) return;
    const dateCell = row.getCell(header.columns.date);
    const dateText = dateCell.text.trim();
    if (!dateText) return;
    const amountText = row.getCell(header.columns.amount).text.trim();
    if (!amountText) return;
    rows.push({
      rowNo: rowNumber,
      transactionDate: parseExcelDate(dateCell.value, dateText),
      description: row.getCell(header.columns.description).text.trim(),
      amount: parseMoney(amountText),
      balance: parseMoney(row.getCell(header.columns.balance).text),
      transactionNo: row.getCell(header.columns.transactionNo).text.trim() || null,
      raw: Array.from({ length: row.cellCount }, (_, index) => row.getCell(index + 1).text).join("|"),
    });
  });
  if (!rows.length) throw new Error("File Excel BIDV không có dữ liệu giao dịch");
  return rows;
}

function findTechcombankTableHeader(worksheet: ExcelJS.Worksheet) {
  let header: { rowNumber: number; columns: TechcombankTableColumns } | null = null;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (header) return;
    const cells = Array.from({ length: Math.max(row.cellCount, 6) }, (_, index) =>
      normalize(row.getCell(index + 1).text),
    );
    const findColumn = (name: string) => cells.findIndex((cell) => cell === name) + 1;
    const columns = {
      date: findColumn("ngay"),
      description: findColumn("dien giai"),
      detail: findColumn("chi tiet"),
      debit: findColumn("no"),
      credit: findColumn("co"),
      balance: findColumn("so du"),
    };
    if (Object.values(columns).every((column) => column > 0)) {
      header = { rowNumber, columns };
    }
  });
  return header;
}

function parseTechcombankTable(
  worksheet: ExcelJS.Worksheet,
  header: { rowNumber: number; columns: TechcombankTableColumns },
) {
  const rows: ParsedBankRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= header.rowNumber) return;
    const dateCell = row.getCell(header.columns.date);
    const dateText = dateCell.text.trim();
    if (!dateText) return;

    const debitText = row.getCell(header.columns.debit).text.trim();
    const creditText = row.getCell(header.columns.credit).text.trim();
    if (!debitText && !creditText) return;
    const debit = debitText ? parseMoney(debitText) : new Prisma.Decimal(0);
    const credit = creditText ? parseMoney(creditText) : new Prisma.Decimal(0);
    if (debit.greaterThan(0) && credit.greaterThan(0)) {
      throw new Error(`Dòng ${rowNumber} trong file Techcombank có cả ghi nợ và ghi có`);
    }
    const detail = row.getCell(header.columns.detail).text.trim();
    const description = [row.getCell(header.columns.description).text.trim(), detail]
      .filter(Boolean)
      .join(" | ");
    rows.push({
      rowNo: rowNumber,
      transactionDate: parseExcelDate(dateCell.value, dateText),
      description,
      amount: credit.greaterThan(0) ? credit : debit.mul(-1),
      balance: parseMoney(row.getCell(header.columns.balance).text),
      transactionNo: detail || null,
      raw: Array.from({ length: row.cellCount }, (_, index) => row.getCell(index + 1).text).join("|"),
    });
  });
  if (!rows.length) throw new Error("File Excel Techcombank không có dữ liệu giao dịch");
  return rows;
}

export async function parseBidvExcel(buffer: Buffer): Promise<ParsedBankRow[]> {
  const workbook = new ExcelJS.Workbook();
  const excelBuffer = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(excelBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("File Excel BIDV không có worksheet");

  const tableHeader = findBidvTableHeader(worksheet);
  if (!tableHeader) throw new Error("File Excel BIDV không đúng format bảng hiện tại");
  return parseBidvTable(worksheet, tableHeader);
}

export async function parseTechcombankExcel(buffer: Buffer): Promise<ParsedBankRow[]> {
  const workbook = new ExcelJS.Workbook();
  const excelBuffer = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(excelBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("File Excel Techcombank không có worksheet");
  const tableHeader = findTechcombankTableHeader(worksheet);
  if (!tableHeader) throw new Error("Không tìm thấy bảng giao dịch trong file Excel Techcombank");
  return parseTechcombankTable(worksheet, tableHeader);
}

async function parseBankStatement(buffer: Buffer, bankCode: string) {
  switch (bankCode.trim().toUpperCase()) {
    case "BIDV":
      return parseBidvExcel(buffer);
    case "TCB":
    case "TECHCOMBANK":
      return parseTechcombankExcel(buffer);
    default:
      throw new ConflictError(`Chưa hỗ trợ định dạng sao kê của ngân hàng ${bankCode}`);
  }
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function normalizeBatchReference(value: string) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function getTransactionHashes(bankAccountId: string, row: ParsedBankRow) {
  const identity = row.transactionNo?.trim()
    ? `${bankAccountId}:transaction-no:${row.transactionNo.trim()}`
    : `${bankAccountId}:row:${row.raw}`;
  const transactionHash = crypto.createHash("sha256").update(identity).digest("hex");
  return { transactionHash };
}

function getTokenSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set and at least 32 characters");
  return secret;
}

function createConfirmationToken(payload: ReconciliationTokenPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getTokenSecret()).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function verifyConfirmationToken(token: string): ReconciliationTokenPayload {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) throw new ConflictError("Token đối soát không hợp lệ");
  const expected = crypto.createHmac("sha256", getTokenSecret()).update(encodedPayload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) throw new ConflictError("Token đối soát không hợp lệ");

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new ConflictError("Token đối soát không hợp lệ");
  }
  if (
    !isRecord(decoded) ||
    decoded.version !== 1 ||
    typeof decoded.expiresAt !== "number" ||
    decoded.expiresAt < Date.now() ||
    typeof decoded.bankAccountId !== "string" ||
    typeof decoded.transactionHash !== "string" ||
    typeof decoded.rowNo !== "number" ||
    typeof decoded.transactionDate !== "string" ||
    (decoded.bankTransactionNo !== null && typeof decoded.bankTransactionNo !== "string") ||
    typeof decoded.description !== "string" ||
    typeof decoded.creditAmount !== "string" ||
    typeof decoded.debitAmount !== "string" ||
    (decoded.balanceAmount !== null && typeof decoded.balanceAmount !== "string") ||
    (decoded.paymentBatchId !== null && typeof decoded.paymentBatchId !== "string")
  ) throw new ConflictError("Token đối soát không hợp lệ");
  return decoded as ReconciliationTokenPayload;
}

function createTokenPayload(
  bankAccountId: string,
  transactionHash: string,
  row: ParsedBankRow,
  paymentBatchId: string | null,
): ReconciliationTokenPayload {
  return {
    version: 1,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    bankAccountId,
    transactionHash,
    rowNo: row.rowNo,
    transactionDate: row.transactionDate.toISOString(),
    bankTransactionNo: row.transactionNo,
    description: row.description,
    creditAmount: row.amount.toString(),
    debitAmount: row.amount.isNegative() ? row.amount.abs().toString() : "0",
    balanceAmount: row.balance?.toString() ?? null,
    paymentBatchId,
  };
}

export async function importBankStatement(args: {
  buffer: Buffer;
  fileName: string;
  bankAccountId: string;
}): Promise<BankImportResult> {
  const bank = await prisma.bankAccount.findUnique({
    where: { id: args.bankAccountId },
    select: { id: true, isActive: true, bankCode: true },
  });
  if (!bank) throw new NotFoundError("Không tìm thấy tài khoản ngân hàng");
  if (!bank.isActive) throw new ConflictError("Tài khoản ngân hàng đã ngừng hoạt động");
  const rows = await parseBankStatement(args.buffer, bank.bankCode);

  const rowHashes = rows.map((row) => getTransactionHashes(args.bankAccountId, row));
  const transactionHashes = rowHashes.map(({ transactionHash }) => transactionHash);
  const transactionNumbers = rows
    .map((row) => row.transactionNo?.trim())
    .filter((value): value is string => Boolean(value));
  const existingPayments = await prisma.tuitionPayment.findMany({
    where: {
      paymentStatus: TuitionPaymentStatus.SUCCESS,
      bankAccountId: args.bankAccountId,
      OR: [
        { transactionReference: { in: transactionHashes } },
        ...(transactionNumbers.length ? [{ bankTransactionNo: { in: transactionNumbers } }] : []),
      ],
    },
    select: { transactionReference: true, bankTransactionNo: true },
  });
  const existingReferences = new Set(
    existingPayments.flatMap((payment) => [payment.transactionReference, payment.bankTransactionNo]),
  );

  const creditRows = rows.filter((row) => row.amount.greaterThan(0));
  const amounts = [...new Set(creditRows.map((row) => row.amount.toString()))].map(
    (amount) => new Prisma.Decimal(amount),
  );
  const pendingBatches = amounts.length
    ? await prisma.paymentBatch.findMany({
        where: { status: PaymentBatchStatus.PENDING, totalAmount: { in: amounts } },
        include: { student: true, allocations: { include: { tuitionFee: true } } },
      })
    : [];

  const importedHashes = new Set<string>();
  const items: BankImportItem[] = [];
  let duplicatedRows = 0;
  let matchedRows = 0;
  let unmatchedRows = 0;
  let ignoredRows = 0;

  for (const [index, row] of rows.entries()) {
    const { transactionHash } = rowHashes[index]!;
    const transactionNumber = row.transactionNo?.trim() || null;
    const isCredit = row.amount.greaterThan(0);
    const baseItem = {
      confirmationToken: createConfirmationToken(
        createTokenPayload(args.bankAccountId, transactionHash, row, null),
      ),
      rowNo: row.rowNo,
      transactionDate: row.transactionDate,
      bankTransactionNo: transactionNumber,
      description: row.description,
      creditAmount: isCredit ? row.amount : new Prisma.Decimal(0),
      debitAmount: isCredit ? new Prisma.Decimal(0) : row.amount.abs(),
      balanceAmount: row.balance,
      reconciliationStatus: (isCredit ? "UNMATCHED" : "IGNORED") as ReconciliationStatus,
      paymentBatch: null as BankImportItem["paymentBatch"],
    };
    if (
      importedHashes.has(transactionHash) ||
      existingReferences.has(transactionHash) ||
      (transactionNumber !== null && existingReferences.has(transactionNumber))
    ) {
      duplicatedRows += 1;
      items.push({ ...baseItem, reconciliationStatus: "DUPLICATED" });
      continue;
    }
    importedHashes.add(transactionHash);

    if (!isCredit) {
      ignoredRows += 1;
      items.push(baseItem);
      continue;
    }

    const description = normalizeBatchReference(row.description);
    const batch = pendingBatches.find(
      (candidate) =>
        candidate.totalAmount.equals(row.amount) &&
        description.includes(normalizeBatchReference(candidate.batchNo)),
    );
    if (batch) {
      matchedRows += 1;
      items.push({
        ...baseItem,
        confirmationToken: createConfirmationToken(
          createTokenPayload(args.bankAccountId, transactionHash, row, batch.id),
        ),
        reconciliationStatus: "AUTO_MATCHED",
        paymentBatch: {
          id: batch.id,
          batchNo: batch.batchNo,
          totalAmount: batch.totalAmount,
          student: batch.student,
          allocations: batch.allocations.map((allocation) => ({
            tuitionFeeId: allocation.tuitionFeeId,
            amount: allocation.amount,
            tuitionFee: { feeNo: allocation.tuitionFee.feeNo },
          })),
        },
      });
      continue;
    }
    unmatchedRows += 1;

    items.push({
      ...baseItem,
    });
  }

  return {
    fileName: args.fileName,
    totalRows: rows.length,
    validRows: rows.length,
    invalidRows: 0,
    duplicatedRows,
    matchedRows,
    unmatchedRows,
    ignoredRows,
    items,
  };
}

async function confirmPaymentBatch(
  payload: ReconciliationTokenPayload,
  batchId: string,
  actorId: string,
) {
  if (payload.paymentBatchId !== batchId) throw new ConflictError("Đợt thanh toán không thuộc giao dịch ngân hàng này");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`bank-reconciliation:${payload.transactionHash}`}))`);
    const existingBatch = await tx.paymentBatch.findFirst({
      where: {
        status: PaymentBatchStatus.SUCCESS,
        bankAccountId: payload.bankAccountId,
        transactionReference: payload.transactionHash,
      },
    });
    if (existingBatch) throw new ConflictError("Giao dịch ngân hàng đã được xác nhận");

    const batch = await tx.paymentBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");
    if (batch.status !== PaymentBatchStatus.PENDING) throw new ConflictError("Đợt thanh toán không còn chờ xử lý");
    if (!new Prisma.Decimal(payload.creditAmount).equals(batch.totalAmount)) throw new ConflictError("PAYMENT_AMOUNT_MISMATCH");
    return completePaymentBatch(tx, batchId, actorId, {
      paymentDate: new Date(payload.transactionDate),
      bankAccountId: payload.bankAccountId,
      bankTransactionNo: payload.bankTransactionNo || undefined,
      transactionReference: payload.transactionHash,
      paymentContent: payload.description,
    });
  });
}

export async function confirmBankReconciliation(args: {
  confirmationToken: string;
  batchId: string;
  actorId: string;
}) {
  const payload = verifyConfirmationToken(args.confirmationToken);
  if (new Prisma.Decimal(payload.debitAmount).greaterThan(0)) throw new ConflictError("Không thể đối soát giao dịch ghi nợ");
  return confirmPaymentBatch(payload, args.batchId, args.actorId);
}
