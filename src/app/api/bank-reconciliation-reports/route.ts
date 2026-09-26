import { handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { PaymentBatchStatus, Prisma } from "@prisma/client";
import {
  bankReconciliationReportSchema,
  reportItemDataSchema,
  type BankReconciliationReportDocument,
} from "@/modules/finance/bank/schemas/bank-reconciliation-report.schema";
import {
  verifyBankReconciliationToken,
  verifyBankStatementToken,
} from "@/modules/finance/bank/services/bank-csv.service";
import { buildBankReconciliationReportExcel } from "@/modules/finance/bank/services/bank-reconciliation-report-excel.service";

export const runtime = "nodejs";

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

function decimal(value: string, label: string) {
  try {
    return new Prisma.Decimal(value);
  } catch {
    throw new ConflictError(`${label} trong token đối soát không hợp lệ`);
  }
}

function sameDecimal(left: string, right: string) {
  return decimal(left, "Số tiền").equals(decimal(right, "Số tiền"));
}

function assertSameTransaction(
  source: ReturnType<typeof verifyBankReconciliationToken>,
  candidate: ReturnType<typeof verifyBankReconciliationToken>,
  statement: ReturnType<typeof verifyBankStatementToken>,
) {
  if (
    candidate.bankAccountId !== statement.bankAccountId ||
    candidate.importSessionId !== statement.importSessionId ||
    candidate.rowNo !== source.rowNo ||
    candidate.transactionDate !== source.transactionDate ||
    candidate.bankTransactionNo !== source.bankTransactionNo ||
    candidate.description !== source.description ||
    (candidate.reconciliationContent || "") !== (source.reconciliationContent || "") ||
    !sameDecimal(candidate.creditAmount, source.creditAmount) ||
    !sameDecimal(candidate.debitAmount, source.debitAmount) ||
    candidate.balanceAmount !== source.balanceAmount
  ) {
    throw new ConflictError("Mapping đối soát không thuộc giao dịch trong báo cáo");
  }
}

function getBatchIds(
  token: ReturnType<typeof verifyBankReconciliationToken>,
) {
  return [...new Set([
    ...(token.paymentBatchId ? [token.paymentBatchId] : []),
    ...(token.paymentBatchIds || []),
  ])];
}

async function buildVerifiedReport(
  input: ReturnType<typeof bankReconciliationReportSchema.parse>,
): Promise<BankReconciliationReportDocument> {
  const statementToken = verifyBankStatementToken(input.statementToken);
  if (statementToken.bankAccountId !== input.bankAccountId) {
    throw new ConflictError("Token sao kê không thuộc tài khoản đã chọn");
  }

  const account = await prisma.bankAccount.findUnique({
    where: { id: input.bankAccountId },
    select: { id: true, bankName: true, accountNo: true, accountName: true },
  });
  if (!account) throw new ConflictError("Tài khoản ngân hàng không còn tồn tại");
  if (statementToken.statement.accountNo && statementToken.statement.accountNo !== account.accountNo) {
    throw new ConflictError("Số tài khoản trong file sao kê không khớp tài khoản đã chọn");
  }

  const seenRows = new Set<number>();
  const verified = input.items.map((requestItem) => {
    const source = verifyBankReconciliationToken(requestItem.confirmationToken);
    if (
      source.bankAccountId !== account.id ||
      source.importSessionId !== statementToken.importSessionId ||
      seenRows.has(source.rowNo)
    ) {
      throw new ConflictError("Dữ liệu giao dịch không thuộc cùng phiên sao kê hoặc bị lặp dòng");
    }
    seenRows.add(source.rowNo);

    const sourceStatus = source.reconciliationStatus || (
      decimal(source.creditAmount, "Ghi có").greaterThan(0) ? "UNMATCHED" : "IGNORED"
    );
    if (
      (sourceStatus === "AUTO_MATCHED" && !source.paymentBatchId) ||
      (sourceStatus !== "AUTO_MATCHED" && (source.paymentBatchId || source.paymentBatchIds?.length))
    ) {
      throw new ConflictError("Token trạng thái giao dịch không hợp lệ");
    }

    const mapping = requestItem.mappingConfirmationToken
      ? verifyBankReconciliationToken(requestItem.mappingConfirmationToken)
      : null;
    if (mapping) {
      assertSameTransaction(source, mapping, statementToken);
      if (sourceStatus === "DUPLICATED" || sourceStatus === "IGNORED") {
        throw new ConflictError("Không thể gắn đợt thu cho giao dịch không đối soát");
      }
      if (!getBatchIds(mapping).length) {
        throw new ConflictError("Mapping đối soát không có đợt thu");
      }
    }

    const finalStatus = mapping ? "CONFIRMED" : sourceStatus;
    const batchIds = mapping
      ? getBatchIds(mapping)
      : sourceStatus === "AUTO_MATCHED"
        ? getBatchIds(source)
        : [];
    return {
      source,
      batchIds,
      finalStatus,
    };
  });

  const allBatchIds = [...new Set(verified.flatMap((item) => item.batchIds))];
  const batches = await prisma.paymentBatch.findMany({
    where: { id: { in: allBatchIds }, bankAccountId: account.id },
    select: {
      id: true,
      batchNo: true,
      totalAmount: true,
      status: true,
      student: { select: { code: true, fullName: true } },
      allocations: {
        select: {
          tuitionFeeId: true,
          amount: true,
          tuitionFee: { select: { feeNo: true, class: { select: { name: true } } } },
        },
      },
      receipt: { select: { receiptNo: true } },
    },
  });
  const batchMap = new Map(batches.map((batch) => [batch.id, batch]));
  const pendingCandidates = await prisma.paymentBatch.findMany({
    where: {
      bankAccountId: account.id,
      paymentMethod: "BANK_TRANSFER",
      status: PaymentBatchStatus.PENDING,
    },
    select: { totalAmount: true },
  });

  const items = verified.map(({ source, batchIds, finalStatus }) => {
    const selectedBatches = batchIds.map((batchId) => {
      const batch = batchMap.get(batchId);
      if (!batch) throw new ConflictError("Đợt thu trong token không còn thuộc tài khoản này");
      return batch;
    });
    if (finalStatus === "CONFIRMED" && selectedBatches.some((batch) => batch.status !== PaymentBatchStatus.SUCCESS)) {
      throw new ConflictError("Chỉ được xuất mapping đã xác nhận thành công");
    }
    const creditAmount = decimal(source.creditAmount, "Ghi có");
    const candidateCount = creditAmount.greaterThan(0)
      ? pendingCandidates.filter((candidate) => candidate.totalAmount.equals(creditAmount)).length
      : 0;
    return reportItemDataSchema.parse({
      rowNo: source.rowNo,
      transactionDate: source.transactionDate,
      bankTransactionNo: source.bankTransactionNo,
      description: source.description,
      reconciliationContent: source.reconciliationContent || "",
      creditAmount: creditAmount.toNumber(),
      debitAmount: decimal(source.debitAmount, "Ghi nợ").toNumber(),
      balanceAmount: source.balanceAmount === null ? null : decimal(source.balanceAmount, "Số dư").toNumber(),
      reconciliationStatus: finalStatus,
      paymentBatches: selectedBatches.map((batch) => ({
        batchNo: batch.batchNo,
        totalAmount: batch.totalAmount.toNumber(),
        student: batch.student,
        allocations: batch.allocations.map((allocation) => ({
          amount: allocation.amount.toNumber(),
          tuitionFee: allocation.tuitionFee,
        })),
      })),
      receiptNos: selectedBatches
        .map((batch) => batch.receipt?.receiptNo)
        .filter((receiptNo): receiptNo is string => Boolean(receiptNo)),
      paymentBatchCandidateCount: candidateCount,
      paymentBatchGroupCandidateCount: 0,
    });
  });

  const selectedItems = items.filter((item) =>
    input.scope === "MATCHED"
      ? ["AUTO_MATCHED", "CONFIRMED"].includes(item.reconciliationStatus)
      : input.scope === "UNMATCHED"
        ? item.reconciliationStatus === "UNMATCHED"
        : true,
  );
  const statement = statementToken.statement;
  return {
    fileName: statementToken.fileName,
    bankName: account.bankName,
    accountNo: account.accountNo,
    accountName: account.accountName,
    statement: {
      ...statement,
      openingBalance: statement.openingBalance === null ? null : decimal(statement.openingBalance, "Số dư đầu kỳ").toNumber(),
      closingBalance: statement.closingBalance === null ? null : decimal(statement.closingBalance, "Số dư cuối kỳ").toNumber(),
    },
    invalidRowErrors: statementToken.invalidRowErrors,
    scope: input.scope,
    items: selectedItems,
    balanceItems: items,
  };
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const input = bankReconciliationReportSchema.parse(await request.json());
    const report = await buildVerifiedReport(input);
    const file = await buildBankReconciliationReportExcel(report);
    const period = [report.statement.fromDate, report.statement.toDate]
      .filter(Boolean)
      .map((value) => safeFilePart(value!))
      .join("-");
    const fileName = `bao-cao-doi-soat-${safeFilePart(report.bankName)}-${safeFilePart(report.accountNo)}${period ? `-${period}` : ""}.xlsx`;
    return new Response(file as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "Không thể xuất báo cáo đối soát ngân hàng");
  }
}
