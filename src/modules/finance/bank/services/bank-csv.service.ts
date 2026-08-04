import crypto from "node:crypto";
import {
  Prisma,
  BankImportStatus,
  BankReconciliationStatus,
  BankMatchMethod,
} from "@prisma/client";
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

function parseMoney(value: string): Prisma.Decimal {
  const normalized = value
    .replace(/VND/gi, "")
    .replace(/\s/g, "")
    .replace(/,/g, "");
  return new Prisma.Decimal(normalized || "0");
}

function parseDate(value: string): Date {
  const match = value
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) throw new Error(`Ngày giao dịch không hợp lệ: ${value}`);
  return new Date(
    Date.UTC(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1]),
      Number(match[4] || 0),
      Number(match[5] || 0),
    ),
  );
}

type CsvEncoding = "utf-8" | "windows-1252";

function decodeCsvBuffer(buffer: Buffer): {
  text: string;
  encoding: CsvEncoding;
} {
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true })
        .decode(buffer)
        .replace(/^\uFEFF/, ""),
      encoding: "utf-8",
    };
  } catch {
    return {
      text: new TextDecoder("windows-1252")
        .decode(buffer)
        .replace(/^\uFEFF/, ""),
      encoding: "windows-1252",
    };
  }
}

type CsvDelimiter = "," | ";" | "\t";

function countDelimiter(line: string, delimiter: CsvDelimiter): number {
  let count = 0;
  let quoted = false;

  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) count += 1;
  }

  return count;
}

function detectDelimiter(line: string): CsvDelimiter {
  const delimiters: CsvDelimiter[] = [",", ";", "\t"];
  return delimiters.reduce(
    (selected, delimiter) =>
      countDelimiter(line, delimiter) > countDelimiter(line, selected)
        ? delimiter
        : selected,
    ",",
  );
}

function parseLine(line: string, delimiter: CsvDelimiter): string[] {
  const result: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      result.push(value.trim());
      value = "";
      continue;
    }
    value += char;
  }
  result.push(value.trim());
  return result;
}

export function parseBankCsv(buffer: Buffer): ParsedBankRow[] {
  const { text } = decodeCsvBuffer(buffer);
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("CSV không có dữ liệu giao dịch");
  const delimiter = detectDelimiter(lines[0]!);
  const rows: ParsedBankRow[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const columns = parseLine(lines[index]!, delimiter);
    if (columns.length < 5) continue;
    const amount = parseMoney(columns[2]!);
    rows.push({
      rowNo: index + 1,
      transactionDate: parseDate(columns[0]!),
      description: columns[1]!,
      amount,
      balance: columns[3] ? parseMoney(columns[3]!) : null,
      transactionNo: columns[4] || null,
      raw: lines[index]!,
    });
  }
  return rows;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getTransactionHashes(bankAccountId: string, row: ParsedBankRow) {
  const legacyHash = crypto
    .createHash("sha256")
    .update(`${bankAccountId}:${row.raw}`)
    .digest("hex");
  const identity = row.transactionNo?.trim()
    ? `${bankAccountId}:transaction-no:${row.transactionNo.trim()}`
    : `${bankAccountId}:row:${row.raw}`;
  const transactionHash = crypto
    .createHash("sha256")
    .update(identity)
    .digest("hex");
  return { transactionHash, legacyHash };
}

export async function importBankCsv(args: {
  buffer: Buffer;
  fileName: string;
  fileUrl: string;
  bankAccountId: string;
  actorId: string;
}) {
  const fileHash = crypto
    .createHash("sha256")
    .update(args.buffer)
    .digest("hex");
  const { text, encoding } = decodeCsvBuffer(args.buffer);
  const firstLine = text.split(/\r?\n/).find((line) => line.trim());
  if (!firstLine) throw new Error("CSV không có dữ liệu giao dịch");
  const delimiter = detectDelimiter(firstLine);
  const rows = parseBankCsv(args.buffer);
  const bank = await prisma.bankAccount.findUnique({
    where: { id: args.bankAccountId },
  });
  if (!bank) throw new NotFoundError("Không tìm thấy tài khoản ngân hàng");
  const existing = await prisma.bankStatementImport.findUnique({
    where: {
      bankAccountId_fileHash: { bankAccountId: args.bankAccountId, fileHash },
    },
  });
  if (existing) throw new ConflictError("File sao kê này đã được import");

  return prisma.$transaction(async (tx) => {
    const statement = await tx.bankStatementImport.create({
      data: {
        bankAccountId: args.bankAccountId,
        fileName: args.fileName,
        fileUrl: args.fileUrl,
        fileHash,
        encoding,
        delimiter,
        dateFormat: "d/M/yyyy HH:mm",
        totalRows: rows.length,
        validRows: rows.length,
        invalidRows: 0,
        duplicatedRows: 0,
        importStatus: BankImportStatus.PROCESSING,
        importedBy: args.actorId,
      },
    });
    let matchedRows = 0;
    let unmatchedRows = 0;
    let duplicatedRows = 0;
    const importedHashes = new Set<string>();
    for (const row of rows) {
      const { transactionHash, legacyHash } = getTransactionHashes(
        args.bankAccountId,
        row,
      );
      if (
        importedHashes.has(transactionHash) ||
        (await tx.bankStatementTransaction.findFirst({
          where: {
            bankAccountId: args.bankAccountId,
            OR: [{ transactionHash }, { transactionHash: legacyHash }],
          },
          select: { id: true },
        }))
      ) {
        duplicatedRows += 1;
        continue;
      }
      importedHashes.add(transactionHash);
      const isCredit = row.amount.greaterThan(0);
      const fees = isCredit
        ? await tx.tuitionFee.findMany({
            where: {
              status: { in: ["UNPAID", "OVERDUE"] },
              finalAmount: row.amount,
            },
            include: { student: true },
          })
        : [];
      const description = normalize(row.description);
      const batches = isCredit
        ? await tx.paymentBatch.findMany({
            where: { status: "PENDING", totalAmount: row.amount },
            include: {
              allocations: { include: { tuitionFee: true } },
              student: true,
            },
          })
        : [];
      const batch = batches.find((candidate) =>
        description.includes(normalize(candidate.batchNo)),
      );
      if (batch) {
        matchedRows += 1;
        await tx.bankStatementTransaction.create({
          data: {
            statementImportId: statement.id,
            bankAccountId: args.bankAccountId,
            rowNo: row.rowNo,
            bankTransactionNo: row.transactionNo,
            transactionDate: row.transactionDate,
            description: row.description,
            creditAmount: row.amount,
            debitAmount: 0,
            balanceAmount: row.balance,
            transactionHash,
            reconciliationStatus: BankReconciliationStatus.AUTO_MATCHED,
            matchScore: 100,
            matchMethod: BankMatchMethod.PAYMENT_REFERENCE,
            matchedStudentId: batch.studentId,
            matchedTuitionFeeId: batch.allocations[0]?.tuitionFeeId,
            paymentBatchId: batch.id,
          },
        });
        continue;
      }
      const candidates = fees
        .map((fee) => {
          const code = normalize(fee.student.code);
          const name = normalize(fee.student.fullName);
          const codeMatch = description.includes(code);
          const nameMatch = description.includes(name);
          const score =
            codeMatch && nameMatch ? 100 : codeMatch ? 90 : nameMatch ? 80 : 50;
          return {
            fee,
            score,
            method: codeMatch
              ? BankMatchMethod.STUDENT_CODE
              : nameMatch
                ? BankMatchMethod.STUDENT_NAME
                : BankMatchMethod.AMOUNT,
          };
        })
        .sort((a, b) => b.score - a.score);
      const selected = candidates[0];
      const status = !isCredit
        ? BankReconciliationStatus.IGNORED
        : selected && selected.score >= 80
          ? candidates.length === 1
            ? BankReconciliationStatus.AUTO_MATCHED
            : BankReconciliationStatus.AMBIGUOUS
          : BankReconciliationStatus.UNMATCHED;
      const selectedFee = selected?.fee;
      if (status === BankReconciliationStatus.AUTO_MATCHED) matchedRows += 1;
      else if (isCredit) unmatchedRows += 1;
      const transaction = await tx.bankStatementTransaction.create({
        data: {
          statementImportId: statement.id,
          bankAccountId: args.bankAccountId,
          rowNo: row.rowNo,
          bankTransactionNo: row.transactionNo,
          transactionDate: row.transactionDate,
          description: row.description,
          creditAmount: isCredit ? row.amount : 0,
          debitAmount: isCredit ? 0 : row.amount.abs(),
          balanceAmount: row.balance,
          transactionHash,
          reconciliationStatus: status,
          matchScore: selected?.score,
          matchMethod: selected?.method,
          matchedStudentId:
            status === BankReconciliationStatus.AUTO_MATCHED && selectedFee
              ? selectedFee.studentId
              : undefined,
          matchedTuitionFeeId:
            status === BankReconciliationStatus.AUTO_MATCHED && selectedFee
              ? selectedFee.id
              : undefined,
        },
      });
      for (const candidate of candidates.slice(0, 5))
        await tx.bankStatementMatchCandidate.create({
          data: {
            statementTransactionId: transaction.id,
            studentId: candidate.fee.studentId,
            tuitionFeeId: candidate.fee.id,
            matchMethod: candidate.method,
            matchScore: candidate.score,
            amountDifference: 0,
            isSelected:
              status === BankReconciliationStatus.AUTO_MATCHED && selectedFee
                ? candidate.fee.id === selectedFee.id
                : false,
          },
        });
    }
    return tx.bankStatementImport.update({
      where: { id: statement.id },
      data: {
        matchedRows,
        unmatchedRows,
        duplicatedRows,
        importStatus: BankImportStatus.COMPLETED,
      },
      include: { transactions: true },
    });
  });
}

export async function confirmBankTransaction(
  transactionId: string,
  tuitionFeeId: string,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.bankStatementTransaction.findUnique({
      where: { id: transactionId },
      include: { candidates: true },
    });
    if (!transaction)
      throw new NotFoundError("Không tìm thấy giao dịch ngân hàng");
    if (transaction.debitAmount.greaterThan(0))
      throw new ConflictError("Không thể đối soát giao dịch ghi nợ");
    if (transaction.paymentId)
      throw new ConflictError("Giao dịch ngân hàng đã được xác nhận");
    if (
      !transaction.candidates.some(
        (candidate) => candidate.tuitionFeeId === tuitionFeeId,
      )
    )
      throw new ConflictError(
        "Khoản học phí không thuộc danh sách ứng viên của giao dịch",
      );
    const fee = await tx.tuitionFee.findUnique({
      where: { id: tuitionFeeId },
      include: { payments: { where: { paymentStatus: "SUCCESS" } } },
    });
    if (!fee) throw new NotFoundError("Không tìm thấy khoản học phí");
    if (fee.payments.length || fee.status === "PAID")
      throw new ConflictError("Khoản học phí đã được thanh toán");
    if (!transaction.creditAmount.equals(fee.finalAmount))
      throw new ConflictError("Số tiền sao kê không khớp số tiền học phí");
    const uniqueToken = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const payment = await tx.tuitionPayment.create({
      data: {
        paymentNo: `PAY-BANK-${uniqueToken}`,
        tuitionFeeId: fee.id,
        studentId: fee.studentId,
        paymentDate: transaction.transactionDate,
        amount: fee.finalAmount,
        paymentMethod: "BANK_TRANSFER",
        paymentStatus: "SUCCESS",
        bankAccountId: transaction.bankAccountId,
        bankTransactionNo: transaction.bankTransactionNo,
        transactionReference: transaction.transactionHash,
        paymentContent: transaction.description,
        receivedBy: actorId,
        confirmedBy: actorId,
        confirmedAt: new Date(),
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
    const receipt = await tx.tuitionReceipt.create({
      data: {
        receiptNo: `REC-BANK-${uniqueToken}`,
        paymentId: payment.id,
        issuedBy: actorId,
        receiverName: fee.studentId,
        amount: fee.finalAmount,
      },
    });
    await tx.tuitionFee.update({
      where: { id: fee.id },
      data: { status: "PAID", version: { increment: 1 }, updatedBy: actorId },
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "TUITION_PAYMENT",
        entityId: payment.id,
        action: "SUCCESS",
        dataAfter: {
          paymentId: payment.id,
          tuitionFeeId: fee.id,
          amount: fee.finalAmount.toString(),
          receiptId: receipt.id,
          bankTransactionId: transactionId,
        },
        performedBy: actorId,
      },
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "TUITION_FEE",
        entityId: fee.id,
        action: "PAID",
        dataAfter: {
          paymentId: payment.id,
          status: "PAID",
          bankTransactionId: transactionId,
        },
        performedBy: actorId,
      },
    });
    const updated = await tx.bankStatementTransaction.update({
      where: { id: transactionId },
      data: {
        matchedStudentId: fee.studentId,
        matchedTuitionFeeId: fee.id,
        paymentId: payment.id,
        reconciliationStatus: "CONFIRMED",
        confirmedBy: actorId,
        confirmedAt: new Date(),
        matchMethod: "MANUAL",
      },
      include: { statementImport: true },
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "BANK_STATEMENT_TRANSACTION",
        entityId: transactionId,
        action: "CONFIRM",
        dataAfter: { paymentId: payment.id, tuitionFeeId: fee.id },
        performedBy: actorId,
      },
    });
    return { transaction: updated, payment, receipt };
  });
}

export async function confirmBankBatchTransaction(
  transactionId: string,
  batchId: string,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.bankStatementTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction)
      throw new NotFoundError("Không tìm thấy giao dịch ngân hàng");
    if (transaction.debitAmount.greaterThan(0))
      throw new ConflictError("Không thể đối soát giao dịch ghi nợ");
    if (transaction.paymentId)
      throw new ConflictError("Giao dịch ngân hàng đã được xác nhận");
    if (transaction.paymentBatchId !== batchId)
      throw new ConflictError("Đợt thanh toán không thuộc giao dịch ngân hàng này");
    const batch = await tx.paymentBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");
    if (batch.status !== "PENDING")
      throw new ConflictError("Đợt thanh toán không còn chờ xử lý");
    if (!transaction.creditAmount.equals(batch.totalAmount))
      throw new ConflictError(
        "Số tiền sao kê không khớp tổng đợt thanh toán",
      );
    const result = await completePaymentBatch(tx, batchId, actorId, {
      paymentDate: transaction.transactionDate,
      bankAccountId: transaction.bankAccountId,
      bankTransactionNo: transaction.bankTransactionNo || undefined,
      transactionReference: transaction.transactionHash || undefined,
      paymentContent: transaction.description || undefined,
    });
    const updated = await tx.bankStatementTransaction.update({
      where: { id: transactionId },
      data: {
        paymentBatchId: batchId,
        matchedStudentId: batch.studentId,
        reconciliationStatus: "CONFIRMED",
        confirmedBy: actorId,
        confirmedAt: new Date(),
        matchMethod: "PAYMENT_REFERENCE",
      },
      include: { statementImport: true },
    });
    return { transaction: updated, batch: result };
  });
}
