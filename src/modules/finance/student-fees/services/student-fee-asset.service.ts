import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";

const PUBLIC_ROOT = path.join(process.cwd(), "public");
const NOTICE_OUTPUT_DIR = path.join(PUBLIC_ROOT, "generated", "payment-notices");
const FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";

type NoticePdfInput = {
  notice: {
    noticeNumber: string;
    dueDate: Date | null;
    amount: number;
    createdAt: Date;
  };
  fee: {
    billingYear: number;
    billingMonth: number;
    amount: number;
    discount: number;
    finalAmount: number;
    student: {
      code: string;
      fullName: string;
      parentName: string | null;
      phone: string | null;
    };
    class: {
      code: string;
      name: string;
    };
  };
  qrCode: {
    qrPayload: string;
    transferContent: string;
    paymentAccount: {
      bankName: string;
      bankCode: string;
      accountNumber: string;
      accountName: string;
    };
  };
};

function normalizePublicUrl(relativePath: string) {
  return `/${relativePath.split(path.sep).join("/")}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatDate(value: Date | null) {
  if (!value) {
    return "Chưa có";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function monthLabel(year: number, month: number) {
  return `${String(month).padStart(2, "0")}/${year}`;
}

function dataUrlToUint8Array(dataUrl: string) {
  const [, base64 = ""] = dataUrl.split(",", 2);
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

function splitTextByWidth(
  text: string,
  maxWidth: number,
  font: {
    widthOfTextAtSize: (text: string, size: number) => number;
  },
  fontSize: number,
) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(nextLine, fontSize) <= maxWidth) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }
    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

export class StudentFeeAssetService {
  static async generateQrDataUrl(qrPayload: string) {
    return QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
    });
  }

  static async generateNoticePdfAsset(input: NoticePdfInput) {
    await mkdir(NOTICE_OUTPUT_DIR, { recursive: true });

    const qrDataUrl = await this.generateQrDataUrl(input.qrCode.qrPayload);
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);

    const fontBytes = await readFile(FONT_PATH);
    const font = await pdf.embedFont(fontBytes, { subset: true });
    const qrImage = await pdf.embedPng(dataUrlToUint8Array(qrDataUrl));

    const page = pdf.addPage([595.28, 841.89]);
    const pageWidth = page.getWidth();
    const left = 48;
    const right = 48;
    const contentWidth = pageWidth - left - right;
    let y = 790;

    const drawLine = (text: string, size = 11, color = rgb(0, 0, 0)) => {
      page.drawText(text, {
        x: left,
        y,
        size,
        font,
        color,
      });
      y -= size + 8;
    };

    const drawWrapped = (label: string, value: string, size = 11) => {
      const prefix = `${label}: `;
      const prefixWidth = font.widthOfTextAtSize(prefix, size);
      const lines = splitTextByWidth(value, contentWidth - prefixWidth, font, size);

      page.drawText(prefix, {
        x: left,
        y,
        size,
        font,
        color: rgb(0, 0, 0),
      });

      lines.forEach((line, index) => {
        page.drawText(line, {
          x: left + (index === 0 ? prefixWidth : 0),
          y: y - index * (size + 6),
          size,
          font,
          color: rgb(0, 0, 0),
        });
      });

      y -= Math.max(lines.length, 1) * (size + 6) + 6;
    };

    page.drawText("PHIẾU BÁO HỌC PHÍ", {
      x: left,
      y,
      size: 20,
      font,
      color: rgb(0.11, 0.27, 0.52),
    });
    y -= 30;

    page.drawText("Không phải biên lai thu tiền", {
      x: left,
      y,
      size: 11,
      font,
      color: rgb(0.75, 0.12, 0.12),
    });
    y -= 22;

    drawLine(`Mã phiếu: ${input.notice.noticeNumber}`);
    drawLine(`Ngày tạo: ${formatDate(input.notice.createdAt)}`);
    drawLine(`Tháng học phí: ${monthLabel(input.fee.billingYear, input.fee.billingMonth)}`);
    y -= 6;

    drawWrapped(
      "Học viên",
      `${input.fee.student.code} - ${input.fee.student.fullName}`,
    );
    drawWrapped("Phụ huynh", input.fee.student.parentName || "Chưa cập nhật");
    drawWrapped("Số điện thoại", input.fee.student.phone || "Chưa cập nhật");
    drawWrapped("Lớp", `${input.fee.class.code} - ${input.fee.class.name}`);

    y -= 6;
    drawLine(`Học phí gốc: ${formatCurrency(input.fee.amount)} VND`);
    drawLine(`Giảm giá: ${formatCurrency(input.fee.discount)} VND`);
    drawLine(`Học phí sau giảm giá: ${formatCurrency(input.fee.finalAmount)} VND`);
    drawLine(`Số tiền cần thanh toán: ${formatCurrency(input.notice.amount)} VND`, 12);
    drawLine(`Hạn thanh toán: ${formatDate(input.notice.dueDate)}`);
    y -= 6;

    drawWrapped(
      "Ngân hàng",
      `${input.qrCode.paymentAccount.bankName} (${input.qrCode.paymentAccount.bankCode})`,
    );
    drawWrapped("Số tài khoản", input.qrCode.paymentAccount.accountNumber);
    drawWrapped("Chủ tài khoản", input.qrCode.paymentAccount.accountName);
    drawWrapped("Nội dung chuyển khoản", input.qrCode.transferContent);

    const qrSize = 180;
    page.drawImage(qrImage, {
      x: pageWidth - right - qrSize,
      y: 390,
      width: qrSize,
      height: qrSize,
    });

    page.drawText("QR thanh toán", {
      x: pageWidth - right - qrSize,
      y: 575,
      size: 12,
      font,
      color: rgb(0.11, 0.27, 0.52),
    });

    page.drawText(
      "Vui lòng quét QR hoặc chuyển khoản đúng số tiền và nội dung.",
      {
        x: left,
        y: 80,
        size: 10,
        font,
        color: rgb(0.25, 0.25, 0.25),
      },
    );

    const pdfBytes = await pdf.save();
    const fileName = `${input.notice.noticeNumber}.pdf`;
    const outputPath = path.join(NOTICE_OUTPUT_DIR, fileName);
    await writeFile(outputPath, pdfBytes);

    return {
      pdfUrl: normalizePublicUrl(path.join("generated", "payment-notices", fileName)),
      qrDataUrl,
    };
  }
}
