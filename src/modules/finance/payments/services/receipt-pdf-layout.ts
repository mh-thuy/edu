import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { getPdfBoldFontBytes, getPdfFontBytes } from "@/lib/pdf-font";
import { vietnameseAmountInWords } from "@/lib/vietnamese-amount";

const A5_PAGE_SIZE: [number, number] = [419.53, 595.28];
const A5_SCALE = A5_PAGE_SIZE[0] / 595;

type ReceiptPdfData = {
  receiptNo: string;
  collectedAt: Date;
  student: { code: string; fullName: string };
  fees: Array<{
    label: string;
    adjustments?: Array<{ label: string; amount: number; negative?: boolean }>;
    amount?: number;
  }>;
  amount: string;
  amountLabel?: string;
  paymentMethod: string;
  paymentReference?: string | null;
};

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

const formatVietnamDateTime = (value: Date) => {
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
};

export async function renderReceiptPdf({
  receiptNo,
  collectedAt,
  student,
  fees,
  amount,
  amountLabel = "TỔNG CỘNG",
  paymentMethod,
  paymentReference,
}: ReceiptPdfData) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await getPdfFontBytes(), { subset: true });
  const boldFont = await pdf.embedFont(await getPdfBoldFontBytes(), { subset: true });
  let page = pdf.addPage(A5_PAGE_SIZE);
  const ink = rgb(0.12, 0.12, 0.12);
  const muted = rgb(0.42, 0.42, 0.42);
  const rule = rgb(0.68, 0.68, 0.68);
  const textWidth = (text: string, size: number, bold = false) =>
    (bold ? boldFont : font).widthOfTextAtSize(text, size);
  const draw = (text: string, x: number, y: number, size = 11, color = ink, bold = false) =>
    page.drawText(text, {
      x: x * A5_SCALE,
      y: y * A5_SCALE,
      size: size * A5_SCALE,
      font: bold ? boldFont : font,
      color,
    });
  const drawCentered = (text: string, y: number, size: number, bold = false) =>
    draw(text, (595 - textWidth(text, size, bold)) / 2, y, size, ink, bold);
  const drawRight = (text: string, right: number, y: number, size: number, bold = false) =>
    draw(text, right - textWidth(text, size, bold), y, size, ink, bold);
  const drawRule = (y: number) =>
    page.drawLine({
      start: { x: 55 * A5_SCALE, y: y * A5_SCALE },
      end: { x: 540 * A5_SCALE, y: y * A5_SCALE },
      thickness: A5_SCALE * 0.7,
      color: rule,
    });
  const fitText = (text: string, maxWidth: number, size: number) =>
    textWidth(text, size) <= maxWidth
      ? size
      : size * maxWidth / textWidth(text, size);
  const drawContinuationHeader = () => {
    drawCentered("BIÊN LAI THANH TOÁN HỌC PHÍ", 790, 16);
    draw("CÁC KHOẢN THU (TIẾP)", 55, 756, 11, muted);
    drawRule(744);
  };
  const drawFooter = () => drawCentered("Biên lai được phát hành từ hệ thống quản lý học phí.", 75, 9);
  const hasFeeAmounts = fees.some((fee) => fee.amount !== undefined);

  drawCentered("BIÊN LAI THANH TOÁN HỌC PHÍ", 780, 19);
  draw("SỐ BIÊN LAI", 55, 744, 10, muted);
  draw("NGÀY THU", 335, 744, 10, muted);
  draw(receiptNo, 55, 724, 12);
  draw(formatVietnamDateTime(collectedAt), 335, 724, 11);
  drawRule(704);

  draw("THÔNG TIN HỌC SINH", 55, 678, 12, muted);
  draw(`Mã học sinh: ${student.code}`, 65, 653, 12);
  draw(`Họ tên: ${student.fullName}`, 65, 631, 15, ink, true);
  drawRule(610);

  draw("KHOẢN THU", 55, 584, 12, muted);
  draw("KHOẢN / LỚP", 65, 560, 10, muted);
  if (hasFeeAmounts) drawRight("SỐ TIỀN", 535, 560, 10);
  drawRule(548);
  drawFooter();

  let y = 524;
  for (const fee of fees) {
    if (y < 300) {
      page = pdf.addPage(A5_PAGE_SIZE);
      drawContinuationHeader();
      drawFooter();
      y = 716;
    }
    draw(fee.label, 65, y, fitText(fee.label, 360, 12));
    if (fee.amount !== undefined) drawRight(`${money(fee.amount)} VND`, 535, y, 11);
    y -= 23;
    for (const adjustment of fee.adjustments ?? []) {
      const value = `${adjustment.negative ? "-" : ""}${money(adjustment.amount)} VND`;
      draw(adjustment.label, 75, y, 10, muted);
      drawRight(value, 535, y, 10);
      y -= 17;
    }
  }

  if (y < 335) {
    page = pdf.addPage(A5_PAGE_SIZE);
    drawContinuationHeader();
    drawFooter();
    draw("TỔNG KẾT THANH TOÁN", 55, 700, 11, muted);
    y = 680;
  }
  drawRule(y - 8);
  draw(amountLabel, 65, y - 36, 15, ink, true);
  drawRight(`${money(Number(amount))} VND`, 535, y - 36, 16, true);
  const amountInWords = `Bằng chữ: ${vietnameseAmountInWords(amount)}`;
  draw(amountInWords, 65, y - 60, fitText(amountInWords, 470, 10));
  draw(`Phương thức: ${paymentMethod}`, 65, y - 83, 11);
  if (paymentReference) draw(`Mã giao dịch: ${paymentReference}`, 65, y - 103, 10, muted);
  return Buffer.from(await pdf.save());
}
