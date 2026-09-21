import crypto from "node:crypto";
import ExcelJS from "exceljs";
import { Prisma, PaymentBatchStatus, TuitionPaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";
import { auditFields, type AuditContext } from "@/lib/audit";
import { completePaymentBatch } from "@/modules/finance/payments/services/payment-batch.service";

export type ParsedBankRow = {
  rowNo: number;
  transactionDate: Date;
  description: string;
  amount: Prisma.Decimal;
  balance: Prisma.Decimal | null;
  transactionNo: string | null;
  transactionNoIsExplicit?: boolean;
  raw: string;
};

type ParsedBankRowError = {
  rowNo: number;
  message: string;
};

type ParsedBankRows = {
  rows: ParsedBankRow[];
  errors: ParsedBankRowError[];
  totalRows: number;
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
  paymentBatchIds?: string[];
};

type PaymentBatchMatch = {
  id: string;
  batchNo: string;
  totalAmount: Prisma.Decimal;
  student: { code: string; fullName: string };
  allocations: Array<{
    tuitionFeeId: string;
    amount: Prisma.Decimal;
    tuitionFee: { feeNo: string; class: { name: string } };
  }>;
};

type PaymentBatchGroupMatch = {
  batchIds: string[];
  totalAmount: Prisma.Decimal;
  batches: PaymentBatchMatch[];
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
  paymentBatch: PaymentBatchMatch | null;
  paymentBatchCandidates: Array<PaymentBatchMatch & { confirmationToken: string }>;
  paymentBatchGroupCandidates: Array<PaymentBatchGroupMatch & { confirmationToken: string }>;
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
  invalidRowErrors: ParsedBankRowError[];
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
  const errors: ParsedBankRowError[] = [];
  let totalRows = 0;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= header.rowNumber) return;
    const dateCell = row.getCell(header.columns.date);
    const dateText = dateCell.text.trim();
    if (!dateText) return;
    const amountText = row.getCell(header.columns.amount).text.trim();
    if (!amountText) return;
    totalRows += 1;
    try {
      rows.push({
        rowNo: rowNumber,
        transactionDate: parseExcelDate(dateCell.value, dateText),
        description: row.getCell(header.columns.description).text.trim(),
        amount: parseMoney(amountText),
        balance: parseMoney(row.getCell(header.columns.balance).text),
        transactionNo: row.getCell(header.columns.transactionNo).text.trim() || null,
        transactionNoIsExplicit: true,
        raw: Array.from({ length: row.cellCount }, (_, index) => row.getCell(index + 1).text).join("|"),
      });
    } catch (error) {
      errors.push({
        rowNo: rowNumber,
        message: error instanceof Error ? error.message : "Dòng sao kê không hợp lệ",
      });
    }
  });
  if (!totalRows) throw new BadRequestError("File Excel BIDV không có dữ liệu giao dịch");
  return { rows, errors, totalRows };
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
  const errors: ParsedBankRowError[] = [];
  let totalRows = 0;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= header.rowNumber) return;
    const dateCell = row.getCell(header.columns.date);
    const dateText = dateCell.text.trim();
    if (!dateText) return;

    const debitText = row.getCell(header.columns.debit).text.trim();
    const creditText = row.getCell(header.columns.credit).text.trim();
    if (!debitText && !creditText) return;
    totalRows += 1;
    try {
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
        // Techcombank's CHI TIET is narrative content, not a transaction ID.
        transactionNo: detail || null,
        transactionNoIsExplicit: false,
        raw: Array.from({ length: row.cellCount }, (_, index) => row.getCell(index + 1).text).join("|"),
      });
    } catch (error) {
      errors.push({
        rowNo: rowNumber,
        message: error instanceof Error ? error.message : "Dòng sao kê không hợp lệ",
      });
    }
  });
  if (!totalRows) throw new BadRequestError("File Excel Techcombank không có dữ liệu giao dịch");
  return { rows, errors, totalRows };
}

export async function parseBidvExcel(buffer: Buffer): Promise<ParsedBankRows> {
  const workbook = new ExcelJS.Workbook();
  const excelBuffer = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(excelBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new BadRequestError("File Excel BIDV không có worksheet");

  const tableHeader = findBidvTableHeader(worksheet);
  if (!tableHeader) throw new BadRequestError("File Excel BIDV không đúng format bảng hiện tại");
  return parseBidvTable(worksheet, tableHeader);
}

export async function parseTechcombankExcel(buffer: Buffer): Promise<ParsedBankRows> {
  const workbook = new ExcelJS.Workbook();
  const excelBuffer = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(excelBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new BadRequestError("File Excel Techcombank không có worksheet");
  const tableHeader = findTechcombankTableHeader(worksheet);
  if (!tableHeader) throw new BadRequestError("Không tìm thấy bảng giao dịch trong file Excel Techcombank");
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

function getBankTransactionNo(row: ParsedBankRow) {
  return row.transactionNoIsExplicit === false ? null : row.transactionNo?.trim() || null;
}

function hashTransactionIdentity(identity: string) {
  return crypto.createHash("sha256").update(identity).digest("hex");
}

function getTransactionHashes(bankAccountId: string, row: ParsedBankRow) {
  const transactionNo = getBankTransactionNo(row);
  const identity = transactionNo
    ? `${bankAccountId}:transaction-no:${transactionNo}`
    : `${bankAccountId}:row:${row.transactionDate.toISOString()}:${row.amount.toString()}:${normalize(row.description)}:${row.balance?.toString() ?? ""}`;
  const transactionHash = hashTransactionIdentity(identity);
  const legacyTransactionHashes = row.transactionNoIsExplicit === false
    ? [
        // Preserve duplicate protection for TCB rows imported before CHI TIET
        // was correctly treated as narrative rather than as a transaction number.
        ...(row.transactionNo?.trim()
          ? [hashTransactionIdentity(`${bankAccountId}:transaction-no:${row.transactionNo.trim()}`)]
          : []),
        // Preserve rows imported with the previous raw-row identity while new
        // imports use a format-stable identity.
        ...(!transactionNo
          ? [hashTransactionIdentity(`${bankAccountId}:row:${row.raw}`)]
          : []),
      ]
    : [];
  return { transactionHash, legacyTransactionHashes };
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
    (decoded.paymentBatchId !== null && typeof decoded.paymentBatchId !== "string") ||
    (decoded.paymentBatchIds !== undefined &&
      (!Array.isArray(decoded.paymentBatchIds) ||
        decoded.paymentBatchIds.length < 2 ||
        decoded.paymentBatchIds.some((batchId) => typeof batchId !== "string")))
  ) throw new ConflictError("Token đối soát không hợp lệ");
  return decoded as ReconciliationTokenPayload;
}

function createTokenPayload(
  bankAccountId: string,
  transactionHash: string,
  row: ParsedBankRow,
  paymentBatchId: string | null,
  paymentBatchIds?: string[],
): ReconciliationTokenPayload {
  return {
    version: 1,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    bankAccountId,
    transactionHash,
    rowNo: row.rowNo,
    transactionDate: row.transactionDate.toISOString(),
    bankTransactionNo: getBankTransactionNo(row),
    description: row.description,
    creditAmount: row.amount.toString(),
    debitAmount: row.amount.isNegative() ? row.amount.abs().toString() : "0",
    balanceAmount: row.balance?.toString() ?? null,
    paymentBatchId,
    ...(paymentBatchIds?.length ? { paymentBatchIds } : {}),
  };
}

function findExactBatchGroups(
  batches: PaymentBatchMatch[],
  targetAmount: Prisma.Decimal,
  reservedBatchIds: Set<string>,
  maxGroups = 20,
  maxBatchCount = 8,
): PaymentBatchMatch[][] {
  const candidates = batches
    .filter((batch) => !reservedBatchIds.has(batch.id) && batch.totalAmount.lessThan(targetAmount))
    .sort((left, right) => left.totalAmount.comparedTo(right.totalAmount));
  const groups: PaymentBatchMatch[][] = [];
  let visited = 0;

  function visit(start: number, total: Prisma.Decimal, selected: PaymentBatchMatch[]) {
    if (groups.length >= maxGroups || selected.length >= maxBatchCount || visited >= 100_000) return;
    for (let index = start; index < candidates.length; index += 1) {
      visited += 1;
      const candidate = candidates[index]!;
      const nextTotal = total.add(candidate.totalAmount);
      if (nextTotal.greaterThan(targetAmount)) continue;
      const nextSelected = [...selected, candidate];
      if (nextTotal.equals(targetAmount)) {
        if (nextSelected.length >= 2) groups.push(nextSelected);
        continue;
      }
      visit(index + 1, nextTotal, nextSelected);
      if (groups.length >= maxGroups) return;
    }
  }

  visit(0, new Prisma.Decimal(0), []);
  return groups;
}

function toPaymentBatchMatch(batch: PaymentBatchMatch): PaymentBatchMatch {
  return {
    id: batch.id,
    batchNo: batch.batchNo,
    totalAmount: batch.totalAmount,
    student: batch.student,
    allocations: batch.allocations.map((allocation) => ({
      tuitionFeeId: allocation.tuitionFeeId,
      amount: allocation.amount,
      tuitionFee: {
        feeNo: allocation.tuitionFee.feeNo,
        class: allocation.tuitionFee.class,
      },
    })),
  };
}

export async function importBankStatement(args: {
  buffer: Buffer;
  fileName: string;
  bankAccountId: string;
  actorId: string;
  auditContext?: AuditContext;
}): Promise<BankImportResult> {
  const bank = await prisma.bankAccount.findUnique({
    where: { id: args.bankAccountId },
    select: { id: true, isActive: true, bankCode: true },
  });
  if (!bank) throw new NotFoundError("Không tìm thấy tài khoản ngân hàng");
  if (!bank.isActive) throw new ConflictError("Tài khoản ngân hàng đã ngừng hoạt động");
  const parsed = await parseBankStatement(args.buffer, bank.bankCode);
  const { rows, errors: invalidRowErrors } = parsed;

  const rowHashes = rows.map((row) => getTransactionHashes(args.bankAccountId, row));
  const transactionHashes = rowHashes.flatMap(({ transactionHash, legacyTransactionHashes }) => [
    transactionHash,
    ...legacyTransactionHashes,
  ]);
  const transactionNumbers = rows
    .map((row) => getBankTransactionNo(row))
    .filter((value): value is string => Boolean(value));
  const existingPayments = await prisma.tuitionPayment.findMany({
    where: {
      paymentStatus: {
        in: [
          TuitionPaymentStatus.SUCCESS,
          TuitionPaymentStatus.CANCELLED,
          TuitionPaymentStatus.REFUNDED,
        ],
      },
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

  const pendingBatches = await prisma.paymentBatch.findMany({
    where: {
      status: PaymentBatchStatus.PENDING,
      paymentMethod: "BANK_TRANSFER",
      bankAccountId: args.bankAccountId,
    },
    orderBy: { createdAt: "asc" },
    include: {
      student: true,
      allocations: {
        include: {
          tuitionFee: { include: { class: { select: { name: true } } } },
        },
      },
    },
  });

  const importedHashes = new Set<string>();
  const autoMatchCandidatesByRow = new Map<number, PaymentBatchMatch>();
  const autoMatchCandidateCounts = new Map<string, number>();

  for (const [index, row] of rows.entries()) {
    if (!row.amount.greaterThan(0)) continue;
    const description = normalizeBatchReference(row.description);
    const candidates = pendingBatches.filter(
      (candidate) =>
        candidate.totalAmount.equals(row.amount) &&
        description.includes(normalizeBatchReference(candidate.batchNo)),
    );
    if (candidates.length === 1) {
      const candidate = candidates[0]!;
      autoMatchCandidatesByRow.set(index, candidate);
      autoMatchCandidateCounts.set(
        candidate.id,
        (autoMatchCandidateCounts.get(candidate.id) || 0) + 1,
      );
    }
  }
  const reservedAutoMatchedBatchIds = new Set(
    [...autoMatchCandidateCounts.entries()]
      .filter(([, count]) => count === 1)
      .map(([batchId]) => batchId),
  );

  const items: BankImportItem[] = [];
  let duplicatedRows = 0;
  let matchedRows = 0;
  let unmatchedRows = 0;
  let ignoredRows = 0;

  for (const [index, row] of rows.entries()) {
    const { transactionHash } = rowHashes[index]!;
    const transactionNumber = getBankTransactionNo(row);
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
      paymentBatchCandidates: [] as BankImportItem["paymentBatchCandidates"],
      paymentBatchGroupCandidates: [] as BankImportItem["paymentBatchGroupCandidates"],
    };
    if (
      importedHashes.has(transactionHash) ||
      rowHashes[index]!.legacyTransactionHashes.some((hash) => importedHashes.has(hash)) ||
      existingReferences.has(transactionHash) ||
      rowHashes[index]!.legacyTransactionHashes.some((hash) => existingReferences.has(hash)) ||
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

    const autoMatchCandidate = autoMatchCandidatesByRow.get(index);
    const batch =
      autoMatchCandidate &&
      autoMatchCandidateCounts.get(autoMatchCandidate.id) === 1 &&
      autoMatchCandidate;
    if (batch) {
      matchedRows += 1;
      const paymentBatch = toPaymentBatchMatch(batch);
      items.push({
        ...baseItem,
        confirmationToken: createConfirmationToken(
          createTokenPayload(args.bankAccountId, transactionHash, row, batch.id),
        ),
        reconciliationStatus: "AUTO_MATCHED",
        paymentBatch,
      });
      continue;
    }
    unmatchedRows += 1;

    const paymentBatchCandidates = pendingBatches
      .filter(
        (candidate) =>
          candidate.totalAmount.equals(row.amount) &&
          !reservedAutoMatchedBatchIds.has(candidate.id),
      )
      .map((candidate) => ({
        ...toPaymentBatchMatch(candidate),
        confirmationToken: createConfirmationToken(
          createTokenPayload(args.bankAccountId, transactionHash, row, candidate.id),
        ),
      }));
    const paymentBatchGroups = findExactBatchGroups(
      pendingBatches.map(toPaymentBatchMatch),
      row.amount,
      reservedAutoMatchedBatchIds,
    ).map((batches) => {
      const batchIds = batches.map((batch) => batch.id);
      return {
        batchIds,
        totalAmount: row.amount,
        batches,
        confirmationToken: createConfirmationToken(
          createTokenPayload(args.bankAccountId, transactionHash, row, null, batchIds),
        ),
      };
    });

    items.push({
      ...baseItem,
      paymentBatchCandidates,
      paymentBatchGroupCandidates: paymentBatchGroups,
    });
  }

  const result = {
    fileName: args.fileName,
    totalRows: parsed.totalRows,
    validRows: rows.length,
    invalidRows: invalidRowErrors.length,
    duplicatedRows,
    matchedRows,
    unmatchedRows,
    ignoredRows,
    invalidRowErrors,
    items,
  };
  await prisma.tuitionAuditLog.createMany({
    data: items.map((item, index) => ({
      entityType: "BANK_ACCOUNT",
      entityId: args.bankAccountId,
      action: `STATEMENT_ROW_${item.reconciliationStatus}`,
      dataAfter: {
        fileName: args.fileName,
        rowNo: item.rowNo,
        transactionHash: rowHashes[index]?.transactionHash ?? null,
        bankTransactionNo: item.bankTransactionNo,
        creditAmount: item.creditAmount.toString(),
        debitAmount: item.debitAmount.toString(),
        paymentBatchId: item.paymentBatch?.id ?? null,
      },
      performedBy: args.actorId,
      ...auditFields(args.auditContext),
    })),
  });
  await prisma.tuitionAuditLog.create({
    data: {
      entityType: "BANK_ACCOUNT",
      entityId: args.bankAccountId,
      action: "STATEMENT_IMPORTED",
      reason: args.fileName,
      dataAfter: {
        fileName: args.fileName,
        totalRows: result.totalRows,
        matchedRows: result.matchedRows,
        unmatchedRows: result.unmatchedRows,
        duplicatedRows: result.duplicatedRows,
        ignoredRows: result.ignoredRows,
        invalidRows: result.invalidRows,
      },
      performedBy: args.actorId,
      ...auditFields(args.auditContext),
    },
  });
  return result;
}

async function confirmPaymentBatch(
  payload: ReconciliationTokenPayload,
  batchId: string,
  actorId: string,
  transaction?: Prisma.TransactionClient,
  auditContext?: AuditContext,
) {
  if (payload.paymentBatchId !== batchId) throw new ConflictError("Đợt thanh toán không thuộc giao dịch ngân hàng này");
  const execute = async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`bank-reconciliation:${payload.transactionHash}`}))`);
    if (payload.bankTransactionNo) {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`bank-reconciliation-no:${payload.bankAccountId}:${payload.bankTransactionNo}`}))`,
      );
    }
    const existingBatch = await tx.paymentBatch.findFirst({
      where: {
        id: { not: batchId },
        bankAccountId: payload.bankAccountId,
        OR: [
          { transactionReference: payload.transactionHash },
          ...(payload.bankTransactionNo
            ? [{ bankTransactionNo: payload.bankTransactionNo }]
            : []),
        ],
      },
    });
    if (existingBatch) {
      throw new ConflictError(
        "Giao dịch ngân hàng đã được xác nhận",
        "STATEMENT_DUPLICATE",
      );
    }

    const batch = await tx.paymentBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");
    if (batch.status !== PaymentBatchStatus.PENDING) {
      throw new ConflictError(
        "Đợt thanh toán không còn chờ xử lý",
        batch.status === PaymentBatchStatus.SUCCESS
          ? "PAYMENT_ALREADY_CONFIRMED"
          : undefined,
      );
    }
    if (batch.paymentMethod !== "BANK_TRANSFER")
      throw new ConflictError("Chỉ payment batch chuyển khoản mới được đối soát ngân hàng");
    if (batch.bankAccountId !== payload.bankAccountId)
      throw new ConflictError("Tài khoản ngân hàng không khớp với đợt thanh toán");
    if (!new Prisma.Decimal(payload.creditAmount).equals(batch.totalAmount)) {
      throw new ConflictError(
        "Số tiền ghi có không khớp với tổng đợt thanh toán",
        "PAYMENT_AMOUNT_MISMATCH",
      );
    }
    const completed = await completePaymentBatch(tx, batchId, actorId, {
      paymentDate: new Date(payload.transactionDate),
      bankAccountId: payload.bankAccountId,
      bankTransactionNo: payload.bankTransactionNo || undefined,
      transactionReference: payload.transactionHash,
      paymentContent: payload.description,
    }, auditContext);
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "PAYMENT_BATCH",
        entityId: batchId,
        action: "BANK_RECONCILIATION_CONFIRMED",
        dataAfter: {
          transactionHash: payload.transactionHash,
          bankAccountId: payload.bankAccountId,
          bankTransactionNo: payload.bankTransactionNo,
          rowNo: payload.rowNo,
          transactionDate: payload.transactionDate,
          creditAmount: payload.creditAmount,
        },
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
    return completed;
  };
  return transaction ? execute(transaction) : prisma.$transaction(execute);
}

export async function confirmBankReconciliation(args: {
  confirmationToken: string;
  batchId: string;
  actorId: string;
  auditContext?: AuditContext;
}) {
  const payload = verifyConfirmationToken(args.confirmationToken);
  if (new Prisma.Decimal(payload.debitAmount).greaterThan(0)) throw new ConflictError("Không thể đối soát giao dịch ghi nợ");
  return confirmPaymentBatch(
    payload,
    args.batchId,
    args.actorId,
    undefined,
    args.auditContext,
  );
}

export async function confirmBankReconciliationGroup(args: {
  confirmationToken: string;
  batchIds: string[];
  actorId: string;
  auditContext?: AuditContext;
}) {
  const payload = verifyConfirmationToken(args.confirmationToken);
  if (new Prisma.Decimal(payload.debitAmount).greaterThan(0)) {
    throw new ConflictError("Không thể đối soát giao dịch ghi nợ");
  }
  const batchIds = [...new Set(args.batchIds)].sort();
  const tokenBatchIds = [...new Set(payload.paymentBatchIds || [])].sort();
  if (
    batchIds.length < 2 ||
    tokenBatchIds.length !== batchIds.length ||
    tokenBatchIds.some((batchId, index) => batchId !== batchIds[index])
  ) {
    throw new ConflictError("Danh sách đợt thanh toán trong token không khớp");
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`bank-reconciliation:${payload.transactionHash}`}))`,
    );
    if (payload.bankTransactionNo) {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`bank-reconciliation-no:${payload.bankAccountId}:${payload.bankTransactionNo}`}))`,
      );
    }

    const existingBatch = await tx.paymentBatch.findFirst({
      where: {
        id: { notIn: batchIds },
        bankAccountId: payload.bankAccountId,
        OR: [
          { transactionReference: payload.transactionHash },
          ...(payload.bankTransactionNo
            ? [{ bankTransactionNo: payload.bankTransactionNo }]
            : []),
        ],
      },
      select: { batchNo: true },
    });
    if (existingBatch) {
      throw new ConflictError(
        `Giao dịch ngân hàng đã được xác nhận cho đợt ${existingBatch.batchNo}`,
        "STATEMENT_DUPLICATE",
      );
    }

    const batches = await tx.paymentBatch.findMany({
      where: { id: { in: batchIds } },
      select: {
        id: true,
        status: true,
        paymentMethod: true,
        bankAccountId: true,
        totalAmount: true,
      },
    });
    if (batches.length !== batchIds.length) {
      throw new NotFoundError("Không tìm thấy đầy đủ các đợt thanh toán");
    }
    if (batches.some((batch) => batch.status !== PaymentBatchStatus.PENDING)) {
      throw new ConflictError("Một hoặc nhiều đợt thanh toán không còn chờ xử lý");
    }
    if (batches.some((batch) => batch.paymentMethod !== "BANK_TRANSFER")) {
      throw new ConflictError("Chỉ có thể gộp các đợt thanh toán chuyển khoản");
    }
    if (batches.some((batch) => batch.bankAccountId !== payload.bankAccountId)) {
      throw new ConflictError("Tài khoản ngân hàng không khớp với một hoặc nhiều đợt thanh toán");
    }
    const totalAmount = batches.reduce(
      (total, batch) => total.add(batch.totalAmount),
      new Prisma.Decimal(0),
    );
    if (!totalAmount.equals(new Prisma.Decimal(payload.creditAmount))) {
      throw new ConflictError(
        "Tổng các đợt thanh toán không khớp số tiền giao dịch ngân hàng",
        "PAYMENT_AMOUNT_MISMATCH",
      );
    }

    const completed = [];
    for (const batchId of batchIds) {
      const completedBatch = await completePaymentBatch(tx, batchId, args.actorId, {
        paymentDate: new Date(payload.transactionDate),
        bankAccountId: payload.bankAccountId,
        bankTransactionNo: payload.bankTransactionNo || undefined,
        transactionReference: payload.transactionHash,
        paymentContent: payload.description,
      }, args.auditContext);
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "PAYMENT_BATCH",
          entityId: batchId,
          action: "BANK_RECONCILIATION_GROUP_CONFIRMED",
          dataAfter: {
            transactionHash: payload.transactionHash,
            bankAccountId: payload.bankAccountId,
            bankTransactionNo: payload.bankTransactionNo,
            rowNo: payload.rowNo,
            transactionDate: payload.transactionDate,
            creditAmount: payload.creditAmount,
            batchIds,
            groupTotalAmount: totalAmount.toString(),
          },
          performedBy: args.actorId,
          ...auditFields(args.auditContext),
        },
      });
      completed.push(completedBatch);
    }
    return { confirmedCount: completed.length, batches: completed };
  });
}

export async function confirmBankReconciliations(args: {
  confirmations: Array<{ confirmationToken: string; batchId: string }>;
  actorId: string;
  auditContext?: AuditContext;
}) {
  const payloads = args.confirmations.map((confirmation) => {
    const payload = verifyConfirmationToken(confirmation.confirmationToken);
    if (new Prisma.Decimal(payload.debitAmount).greaterThan(0)) {
      throw new ConflictError("Không thể đối soát giao dịch ghi nợ");
    }
    return { ...confirmation, payload };
  });

  return prisma.$transaction(async (tx) => {
    const completed = [];
    for (const confirmation of payloads) {
      completed.push(
        await confirmPaymentBatch(
          confirmation.payload,
          confirmation.batchId,
          args.actorId,
          tx,
          args.auditContext,
        ),
      );
    }
    return { confirmedCount: completed.length, batches: completed };
  });
}
