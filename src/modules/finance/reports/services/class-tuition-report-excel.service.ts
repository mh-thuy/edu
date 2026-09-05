import ExcelJS from "exceljs";
import type { ClassTuitionReport } from "@/modules/finance/reports/services/class-tuition-report.service";

const border = {
  top: { style: "thin" as const, color: { argb: "FF000000" } },
  left: { style: "thin" as const, color: { argb: "FF000000" } },
  bottom: { style: "thin" as const, color: { argb: "FF000000" } },
  right: { style: "thin" as const, color: { argb: "FF000000" } },
};

const moneyFormat = "#,##0";

function styleRange(
  worksheet: ExcelJS.Worksheet,
  range: string,
  style: Partial<ExcelJS.Style>,
) {
  worksheet.getCell(range).style = style;
}

export async function buildClassTuitionReportExcel(
  report: ClassTuitionReport,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EduCenter";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Báo cáo học phí");
  worksheet.columns = [
    { key: "stt", width: 8 },
    { key: "givenName", width: 25 },
    { key: "familyName", width: 16 },
    { key: "paidAmount", width: 18 },
    { key: "note", width: 18 },
  ];
  worksheet.properties.defaultRowHeight = 18;
  worksheet.views = [{ state: "frozen", ySplit: 7 }];
  worksheet.pageSetup = {
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: worksheet.pageSetup.paperSize,
    margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  };
  worksheet.mergeCells("A3:B3");
  worksheet.mergeCells("C3:E3");
  worksheet.mergeCells("A6:A7");
  worksheet.mergeCells("B6:C7");
  worksheet.mergeCells("D6:D7");
  worksheet.mergeCells("E6:E7");

  worksheet.getCell("A3").value = `T${Number(report.month.slice(5))}/${report.month.slice(0, 4)}`;
  worksheet.getCell("C3").value = "TRUNG TÂM ĐÀO TẠO";
  worksheet.getCell("B4").value = `Môn: ${report.subjectName}`;
  worksheet.getCell("C4").value = `LỚP: ${report.className}`;
  worksheet.getCell("D4").value = `GV: ${report.teacherName}`;
  worksheet.getCell("A6").value = "STT";
  worksheet.getCell("B6").value = "Họ và tên học viên";
  worksheet.getCell("D6").value = "ĐÃ THU";
  worksheet.getCell("E6").value = "Ghi chú";

  styleRange(worksheet, "A3", {
    font: { name: "Arial", size: 12, bold: true },
    alignment: { horizontal: "center", vertical: "middle" },
  });
  styleRange(worksheet, "C3", {
    font: { name: "Arial", size: 14, bold: true },
    alignment: { horizontal: "center", vertical: "middle" },
  });
  ["B4", "C4", "D4"].forEach((cell) => {
    styleRange(worksheet, cell, {
      font: { name: "Arial", size: 11, bold: true },
      alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    });
  });
  ["A6", "B6", "D6", "E6"].forEach((cell) => {
    styleRange(worksheet, cell, {
      font: { name: "Arial", size: 11, bold: true },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE9D9" } },
      border,
      alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    });
  });
  worksheet.getRow(6).height = 28;
  worksheet.getRow(7).height = 28;

  const firstDataRow = 8;
  report.rows.forEach((row, index) => {
    const excelRow = worksheet.getRow(firstDataRow + index);
    excelRow.values = [index + 1, row.givenName, row.familyName, row.paidAmount, ""];
    excelRow.height = 24;
    excelRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = { name: "Arial", size: 11 };
      cell.border = border;
      cell.alignment = {
        horizontal: columnNumber === 4 ? "right" : columnNumber === 1 ? "center" : "left",
        vertical: "middle",
        wrapText: true,
      };
      if (columnNumber === 4) cell.numFmt = moneyFormat;
    });
  });

  const lastDataRow = Math.max(firstDataRow, firstDataRow + report.rows.length - 1);
  const totalRow = lastDataRow + 1;
  const remainingRow = totalRow + 1;
  const photoRow = totalRow + 2;
  const payableRow = totalRow + 3;
  const closedDateRow = totalRow + 4;

  worksheet.mergeCells(`A${totalRow}:B${totalRow}`);
  worksheet.mergeCells(`A${remainingRow}:C${remainingRow}`);
  worksheet.mergeCells(`A${photoRow}:C${photoRow}`);
  worksheet.mergeCells(`A${payableRow}:C${payableRow}`);
  worksheet.mergeCells(`A${closedDateRow}:C${closedDateRow}`);
  [totalRow, remainingRow, photoRow, payableRow, closedDateRow].forEach((rowNumber) => {
    const row = worksheet.getRow(rowNumber);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: "Arial", size: 11, bold: true };
      cell.border = border;
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    row.height = 24;
  });

  worksheet.getCell(`A${totalRow}`).value = "TỔNG";
  worksheet.getCell(`C${totalRow}`).value = "-";
  worksheet.getCell(`D${totalRow}`).value = {
    formula: `SUM(D${firstDataRow}:D${lastDataRow})`,
    result: report.rows.reduce((total, row) => total + row.paidAmount, 0),
  };
  worksheet.getCell(`A${remainingRow}`).value = "CÒN LẠI SAU KHI TRÍCH %";
  worksheet.getCell(`D${remainingRow}`).value = {
    formula: `D${totalRow}*(100-${report.commissionPercent})/100`,
    result: report.rows.reduce((total, row) => total + row.paidAmount, 0) * (100 - report.commissionPercent) / 100,
  };
  worksheet.getCell(`A${photoRow}`).value = "PHOTO";
  worksheet.getCell(`D${photoRow}`).value = null;
  worksheet.getCell(`A${payableRow}`).value = "SỐ TIỀN CẦN THANH";
  worksheet.getCell(`D${payableRow}`).value = {
    formula: `D${remainingRow}-IF(D${photoRow}=\"\",0,D${photoRow})`,
    result: report.rows.reduce((total, row) => total + row.paidAmount, 0) * (100 - report.commissionPercent) / 100,
  };
  worksheet.getCell(`A${closedDateRow}`).value = "CHỐT THANH NGÀY";
  worksheet.getCell(`D${closedDateRow}`).value = new Date();
  worksheet.getCell(`D${closedDateRow}`).numFmt = "dd/mm/yyyy";

  [totalRow, remainingRow, photoRow, payableRow].forEach((rowNumber) => {
    worksheet.getCell(`D${rowNumber}`).numFmt = moneyFormat;
    worksheet.getCell(`D${rowNumber}`).alignment = { horizontal: "right", vertical: "middle" };
  });
  worksheet.getCell(`D${closedDateRow}`).alignment = { horizontal: "right", vertical: "middle" };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
