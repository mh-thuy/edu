import ExcelJS from "exceljs";
import type { ClassTuitionReport } from "@/modules/finance/reports/services/class-tuition-report.service";

const border = {
  top: { style: "thin" as const, color: { argb: "FF000000" } },
  left: { style: "thin" as const, color: { argb: "FF000000" } },
  bottom: { style: "thin" as const, color: { argb: "FF000000" } },
  right: { style: "thin" as const, color: { argb: "FF000000" } },
};

const moneyFormat = '#,##0 "₫"';
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const colors = {
  navy: "FF1F4E78",
  blue: "FFD9EAF7",
  lightBlue: "FFEAF3F8",
  green: "FFE2F0D9",
  yellow: "FFFFF2CC",
  orange: "FFFCE4D6",
  gray: "FFF2F2F2",
};

function styleRange(
  worksheet: ExcelJS.Worksheet,
  range: string,
  style: Partial<ExcelJS.Style>,
) {
  worksheet.getCell(range).style = style;
}

function toVietnamExcelDate(value: Date) {
  return new Date(value.getTime() + VIETNAM_OFFSET_MS);
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
    { key: "studentCode", width: 18 },
    { key: "studentName", width: 32 },
    { key: "paidAmount", width: 20 },
    { key: "note", width: 24 },
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
  worksheet.mergeCells("A1:E1");
  worksheet.mergeCells("A2:E2");
  worksheet.mergeCells("A3:B3");
  worksheet.mergeCells("C3:E3");
  worksheet.mergeCells("A4:E4");
  worksheet.mergeCells("A6:A7");
  worksheet.mergeCells("B6:B7");
  worksheet.mergeCells("C6:C7");
  worksheet.mergeCells("D6:D7");
  worksheet.mergeCells("E6:E7");

  worksheet.getCell("A1").value = "TRUNG TÂM ĐÀO TẠO";
  worksheet.getCell("A2").value = "BÁO CÁO THU HỌC PHÍ THEO LỚP / MÔN";
  worksheet.getCell("A3").value = `T${Number(report.month.slice(5))}/${report.month.slice(0, 4)}`;
  worksheet.getCell("C3").value = `LỚP: ${report.classCode} - ${report.className}`;
  worksheet.getCell("A4").value = `Môn: ${report.subjectName}  |  GV: ${report.teacherCode} - ${report.teacherName}`;
  worksheet.getCell("A6").value = "STT";
  worksheet.getCell("B6").value = "MÃ HỌC VIÊN";
  worksheet.getCell("C6").value = "HỌ VÀ TÊN HỌC VIÊN";
  worksheet.getCell("D6").value = "ĐÃ THU";
  worksheet.getCell("E6").value = "GHI CHÚ";

  ["A1", "A2", "A3", "C3", "A4"].forEach((cell) => {
    styleRange(worksheet, cell, {
      font: {
        name: "Arial",
        size: cell === "A2" ? 14 : 11,
        bold: true,
        color: { argb: colors.navy },
      },
      alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    });
  });
  worksheet.getRow(1).height = 22;
  worksheet.getRow(2).height = 26;
  worksheet.getRow(3).height = 24;
  worksheet.getRow(4).height = 30;
  ["A6", "B6", "C6", "D6", "E6"].forEach((cell) => {
    styleRange(worksheet, cell, {
      font: { name: "Arial", size: 11, bold: true },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: colors.blue } },
      border,
      alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    });
  });
  worksheet.getRow(6).height = 28;
  worksheet.getRow(7).height = 28;

  const firstDataRow = 8;
  report.rows.forEach((row, index) => {
    const excelRow = worksheet.getRow(firstDataRow + index);
    excelRow.values = [
      index + 1,
      row.studentCode,
      [row.givenName, row.familyName].filter(Boolean).join(" "),
      row.paidAmount,
      "",
    ];
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
    if (index % 2 === 1) {
      excelRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.lightBlue } };
      });
    }
  });

  const lastDataRow = Math.max(firstDataRow, firstDataRow + report.rows.length - 1);
  const totalRow = lastDataRow + 1;
  const remainingRow = totalRow + 1;
  const photoRow = totalRow + 2;
  const payableRow = totalRow + 3;
  const closedDateRow = totalRow + 4;

  worksheet.mergeCells(`A${totalRow}:C${totalRow}`);
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
  worksheet.getCell(`A${photoRow}`).value = "CHI PHÍ PHOTO (NHẬP NẾU CÓ)";
  worksheet.getCell(`D${photoRow}`).value = null;
  worksheet.getCell(`A${payableRow}`).value = "SỐ TIỀN CẦN THANH";
  worksheet.getCell(`D${payableRow}`).value = {
    formula: `D${remainingRow}-IF(D${photoRow}=\"\",0,D${photoRow})`,
    result: report.rows.reduce((total, row) => total + row.paidAmount, 0) * (100 - report.commissionPercent) / 100,
  };
  worksheet.getCell(`A${closedDateRow}`).value = "CHỐT THANH NGÀY";
  worksheet.getCell(`D${closedDateRow}`).value = toVietnamExcelDate(new Date());
  worksheet.getCell(`D${closedDateRow}`).numFmt = "dd/mm/yyyy";

  [totalRow, remainingRow, photoRow, payableRow].forEach((rowNumber) => {
    worksheet.getCell(`D${rowNumber}`).numFmt = moneyFormat;
    worksheet.getCell(`D${rowNumber}`).alignment = { horizontal: "right", vertical: "middle" };
  });
  worksheet.getCell(`D${closedDateRow}`).alignment = { horizontal: "right", vertical: "middle" };
  [totalRow, remainingRow, photoRow, payableRow, closedDateRow].forEach((rowNumber, index) => {
    worksheet.getCell(`A${rowNumber}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: [colors.green, colors.blue, colors.yellow, colors.orange, colors.gray][index] },
    };
    worksheet.getCell(`D${rowNumber}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: [colors.green, colors.blue, colors.yellow, colors.orange, colors.gray][index] },
    };
  });
  worksheet.pageSetup.printArea = `A1:E${closedDateRow}`;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
