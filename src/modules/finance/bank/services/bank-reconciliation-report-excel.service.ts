import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import type {
  BankReconciliationReportDocument,
  BankReconciliationReportItem,
} from "@/modules/finance/bank/schemas/bank-reconciliation-report.schema";

const border = {
  top: { style: "thin" as const, color: { argb: "FFD9E2EC" } },
  left: { style: "thin" as const, color: { argb: "FFD9E2EC" } },
  bottom: { style: "thin" as const, color: { argb: "FFD9E2EC" } },
  right: { style: "thin" as const, color: { argb: "FFD9E2EC" } },
};
const moneyFormat = '#,##0 "₫";[Red]-#,##0 "₫";-';
const colors = {
  navy: "FF1F4E78",
  blue: "FFD9EAF7",
  lightBlue: "FFF4F8FB",
  green: "FFE2F0D9",
  yellow: "FFFFF2CC",
  orange: "FFFCE4D6",
  gray: "FFF2F2F2",
  white: "FFFFFFFF",
};

const statusLabels: Record<string, string> = {
  AUTO_MATCHED: "Tự động khớp",
  UNMATCHED: "Chưa khớp",
  IGNORED: "Bỏ qua",
  DUPLICATED: "Trùng giao dịch",
  CONFIRMED: "Đã xác nhận",
};

function styleCell(cell: ExcelJS.Cell, alignment: Partial<ExcelJS.Alignment> = {}) {
  cell.font = { name: "Arial", size: 10 };
  cell.border = border;
  cell.alignment = { vertical: "middle", wrapText: true, ...alignment };
}

function fill(cell: ExcelJS.Cell, argb: string) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function bold(cell: ExcelJS.Cell, color = colors.navy) {
  cell.font = { name: "Arial", size: 10, bold: true, color: { argb: color } };
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function applyHeader(row: ExcelJS.Row, headers: string[]) {
  headers.forEach((value, index) => {
    const cell = row.getCell(index + 1);
    cell.value = value;
    styleCell(cell, { horizontal: "center" });
    bold(cell);
    fill(cell, colors.blue);
  });
  row.height = 30;
}

function batchSummary(batches: BankReconciliationReportItem["paymentBatches"]) {
  if (!batches.length) {
    return { batchNo: "-", student: "-", studentCode: "-", classes: "-", fees: "-", amount: null };
  }
  return {
    batchNo: batches.map((batch) => batch.batchNo).join(" + "),
    student: batches[0]?.student.fullName || "-",
    studentCode: batches[0]?.student.code || "-",
    classes: [...new Set(batches.flatMap((batch) => batch.allocations.map((allocation) => allocation.tuitionFee.class.name)))].join(", ") || "-",
    fees: [...new Set(batches.flatMap((batch) => batch.allocations.map((allocation) => allocation.tuitionFee.feeNo)))].join(", ") || "-",
    amount: batches.reduce((sum, batch) => sum + batch.totalAmount, 0),
  };
}

export async function buildBankReconciliationReportExcel(
  report: BankReconciliationReportDocument,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EduCenter";
  workbook.created = new Date();

  const reportItems = report.items;
  const balanceItems = report.balanceItems;

  const statusCounts = reportItems.reduce<Record<string, number>>((counts, item) => {
    counts[item.reconciliationStatus] = (counts[item.reconciliationStatus] || 0) + 1;
    return counts;
  }, {});
  const totalCredit = reportItems.reduce((sum, item) => sum + item.creditAmount, 0);
  const totalDebit = new Prisma.Decimal(report.balanceCheck.totalDebit).toNumber();
  const balanceVariance = report.balanceCheck.variance === null
    ? null
    : new Prisma.Decimal(report.balanceCheck.variance).toNumber();

  const overview = workbook.addWorksheet("Tổng quan");
  overview.columns = [{ width: 30 }, { width: 36 }, { width: 20 }, { width: 22 }];
  overview.mergeCells("A1:D1");
  overview.getCell("A1").value = "BÁO CÁO ĐỐI SOÁT SAO KÊ NGÂN HÀNG";
  styleCell(overview.getCell("A1"), { horizontal: "center" });
  overview.getCell("A1").font = { name: "Arial", size: 15, bold: true, color: { argb: colors.navy } };
  overview.getRow(1).height = 28;
  overview.mergeCells("A2:D2");
  overview.getCell("A2").value = `File nguồn: ${report.fileName}`;
  styleCell(overview.getCell("A2"), { horizontal: "center" });
  overview.getRow(2).height = 22;

  const metadata = [
    ["Ngân hàng", report.bankName],
    ["Số tài khoản", report.accountNo],
    ["Tên tài khoản", report.accountName || report.statement.accountName || "-"],
    ["Định dạng sao kê", report.statement.bankFormat],
    ["Phạm vi xuất", report.scope === "ALL" ? "Toàn bộ giao dịch" : report.scope === "MATCHED" ? "Giao dịch đã khớp" : "Giao dịch chưa khớp"],
    ["Từ ngày", report.statement.fromDate || formatDate(balanceItems[0]?.transactionDate || null)],
    ["Đến ngày", report.statement.toDate || formatDate(balanceItems.at(-1)?.transactionDate || null)],
    ["Loại tiền", report.statement.currencyCode || "VND"],
    ["Số dư đầu kỳ", report.statement.openingBalance],
    ["Số dư cuối kỳ", report.statement.closingBalance],
    ["Chênh lệch số dư", balanceVariance],
  ];
  let rowNumber = 4;
  metadata.forEach(([label, value]) => {
    const row = overview.getRow(rowNumber++);
    row.getCell(1).value = label;
    row.getCell(2).value = value ?? "-";
    styleCell(row.getCell(1));
    styleCell(row.getCell(2), { horizontal: typeof value === "number" ? "right" : "left" });
    bold(row.getCell(1));
    if (typeof value === "number") row.getCell(2).numFmt = moneyFormat;
    if (rowNumber % 2 === 0) {
      fill(row.getCell(1), colors.lightBlue);
      fill(row.getCell(2), colors.lightBlue);
    }
  });

  rowNumber += 1;
  overview.getCell(`A${rowNumber}`).value = "TỔNG HỢP KẾT QUẢ";
  overview.mergeCells(`A${rowNumber}:D${rowNumber}`);
  styleCell(overview.getCell(`A${rowNumber}`), { horizontal: "center" });
  bold(overview.getCell(`A${rowNumber}`), colors.white);
  fill(overview.getCell(`A${rowNumber}`), colors.navy);
  rowNumber += 1;
  const summaryRows = [
    ["Tổng giao dịch trong phạm vi", reportItems.length, "dòng"],
    ["Tổng tiền ghi có", totalCredit, "VND"],
    ["Tổng tiền ghi nợ theo sao kê", totalDebit, "VND"],
    ["Kiểm tra số dư", balanceVariance === null ? "Không đủ dữ liệu" : balanceVariance === 0 ? "Sao kê cân" : "Sao kê lệch", ""],
    ["Tự động khớp", statusCounts.AUTO_MATCHED || 0, "dòng"],
    ["Đã xác nhận", statusCounts.CONFIRMED || 0, "dòng"],
    ["Chưa khớp", statusCounts.UNMATCHED || 0, "dòng"],
    ["Trùng giao dịch", statusCounts.DUPLICATED || 0, "dòng"],
    ["Bỏ qua ghi nợ", statusCounts.IGNORED || 0, "dòng"],
    ["Dòng lỗi", report.invalidRowErrors.length, "dòng"],
  ];
  summaryRows.forEach(([label, value, unit], index) => {
    const row = overview.getRow(rowNumber + index);
    row.getCell(1).value = label;
    row.getCell(2).value = value;
    row.getCell(3).value = unit;
    styleCell(row.getCell(1));
    styleCell(row.getCell(2), { horizontal: "right" });
    styleCell(row.getCell(3));
    bold(row.getCell(1));
    if (typeof label === "string" && ["Tổng tiền ghi có", "Tổng tiền ghi nợ theo sao kê", "Chênh lệch số dư"].includes(label)) row.getCell(2).numFmt = moneyFormat;
    const color = label === "Đã xác nhận" || (label === "Kiểm tra số dư" && value === "Sao kê cân")
      ? colors.green
      : label === "Chưa khớp" || label === "Trùng giao dịch" || (label === "Kiểm tra số dư" && value !== "Sao kê cân")
        ? colors.orange
        : colors.gray;
    fill(row.getCell(1), color);
    fill(row.getCell(2), color);
    fill(row.getCell(3), color);
  });
  rowNumber += summaryRows.length + 1;
  if (report.invalidRowErrors.length) {
    overview.getCell(`A${rowNumber}`).value = "DÒNG LỖI KHI ĐỌC FILE";
    overview.mergeCells(`A${rowNumber}:D${rowNumber}`);
    styleCell(overview.getCell(`A${rowNumber}`), { horizontal: "center" });
    bold(overview.getCell(`A${rowNumber}`), colors.white);
    fill(overview.getCell(`A${rowNumber}`), colors.orange);
    report.invalidRowErrors.forEach((error, index) => {
      const row = overview.getRow(rowNumber + index + 1);
      row.getCell(1).value = `Dòng ${error.rowNo}`;
      row.getCell(2).value = error.message;
      overview.mergeCells(`B${rowNumber + index + 1}:D${rowNumber + index + 1}`);
      styleCell(row.getCell(1));
      styleCell(row.getCell(2));
    });
  }
  overview.views = [{ state: "frozen", ySplit: 3 }];

  const detail = workbook.addWorksheet("Chi tiết đối soát");
  detail.columns = [
    { width: 7 }, { width: 8 }, { width: 20 }, { width: 25 }, { width: 54 },
    { width: 44 }, { width: 18 }, { width: 18 }, { width: 20 }, { width: 22 }, { width: 18 },
    { width: 16 }, { width: 30 }, { width: 32 }, { width: 18 }, { width: 24 }, { width: 18 },
    { width: 30 },
  ];
  const detailHeaders = [
    "STT", "Dòng", "Ngày giao dịch", "Mã giao dịch", "Diễn giải / chi tiết",
    "Nội dung đối soát", "Ghi có", "Ghi nợ", "Số dư", "Trạng thái", "Mã đợt thu", "Mã học viên",
    "Học viên", "Lớp / môn học", "Tổng đợt thu", "Số biên lai", "Số ứng viên", "Ghi chú",
  ];
  applyHeader(detail.getRow(1), detailHeaders);
  reportItems.forEach((item, index) => {
    const row = detail.getRow(index + 2);
    const batch = batchSummary(item.paymentBatches);
    const candidateCount = item.paymentBatchCandidateCount + item.paymentBatchGroupCandidateCount;
    const note = item.reconciliationStatus === "AUTO_MATCHED"
      ? "Khớp theo mã đợt và số tiền"
      : item.reconciliationStatus === "CONFIRMED"
        ? "Đã xác nhận đối soát"
        : item.reconciliationStatus === "UNMATCHED"
          ? candidateCount ? "Cần chọn đợt hoặc nhóm đợt phù hợp" : "Không tìm thấy đợt cùng số tiền"
          : item.reconciliationStatus === "DUPLICATED"
            ? "Giao dịch đã được sử dụng trước đó"
            : "Giao dịch ghi nợ, không cần đối soát";
    row.values = [
      index + 1,
      item.rowNo,
      formatDateTime(item.transactionDate),
      item.bankTransactionNo || "-",
      item.description,
      item.reconciliationContent || "-",
      item.creditAmount,
      item.debitAmount,
      item.balanceAmount,
      statusLabels[item.reconciliationStatus] || item.reconciliationStatus,
      batch.batchNo,
      batch.studentCode,
      batch.student,
      batch.classes,
      batch.amount,
      item.receiptNos.join(", ") || "-",
      candidateCount,
      note,
    ];
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      styleCell(cell, { horizontal: [1, 2, 7, 8, 9, 11, 15, 17].includes(columnNumber) ? "right" : "left" });
      if ([7, 8, 9, 15].includes(columnNumber)) cell.numFmt = moneyFormat;
    });
    if (index % 2 === 1) row.eachCell({ includeEmpty: true }, (cell) => fill(cell, colors.lightBlue));
  });
  detail.views = [{ state: "frozen", ySplit: 1 }];
  detail.autoFilter = { from: "A1", to: `R${Math.max(1, reportItems.length + 1)}` };

  const unmatched = workbook.addWorksheet("Chưa khớp");
  unmatched.columns = [{ width: 8 }, { width: 20 }, { width: 25 }, { width: 54 }, { width: 44 }, { width: 18 }, { width: 18 }, { width: 28 }, { width: 18 }, { width: 32 }];
  applyHeader(unmatched.getRow(1), ["STT", "Ngày giao dịch", "Mã giao dịch", "Diễn giải / chi tiết", "Nội dung đối soát", "Ghi có", "Số dư", "Trạng thái", "Số ứng viên", "Hướng xử lý"]);
  reportItems
    .filter((item) => item.reconciliationStatus === "UNMATCHED")
    .forEach((item, index) => {
      const row = unmatched.getRow(index + 2);
      const candidates = item.paymentBatchCandidateCount + item.paymentBatchGroupCandidateCount;
      row.values = [
        index + 1,
        formatDateTime(item.transactionDate),
        item.bankTransactionNo || "-",
        item.description,
        item.reconciliationContent || "-",
        item.creditAmount,
        item.balanceAmount,
        statusLabels[item.reconciliationStatus],
        candidates,
        candidates ? "Mở chi tiết và chọn đúng đợt/nhóm đợt" : "Kiểm tra lại nội dung hoặc tạo đợt thu",
      ];
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        styleCell(cell, { horizontal: [1, 6, 7, 9].includes(columnNumber) ? "right" : "left" });
        if ([6, 7].includes(columnNumber)) cell.numFmt = moneyFormat;
      });
      if (index % 2 === 1) row.eachCell({ includeEmpty: true }, (cell) => fill(cell, colors.lightBlue));
    });
  unmatched.views = [{ state: "frozen", ySplit: 1 }];
  unmatched.autoFilter = { from: "A1", to: `J${Math.max(1, unmatched.rowCount)}` };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
